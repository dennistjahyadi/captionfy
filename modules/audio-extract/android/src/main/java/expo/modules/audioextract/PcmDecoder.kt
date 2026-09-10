package expo.modules.audioextract

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal class NoAudioTrackException :
  expo.modules.kotlin.exception.CodedException("The selected file has no audio track")

internal class UnsupportedPcmEncodingException(encoding: Int) :
  expo.modules.kotlin.exception.CodedException("Decoder produced an unsupported PCM encoding: $encoding")

internal class DecodeFailedException(cause: Throwable) :
  expo.modules.kotlin.exception.CodedException("Failed to decode the audio track", cause)

internal data class DecodedAudio(
  val samples: FloatArray,
  val sampleRate: Int,
  val channelCount: Int,
)

/**
 * Decodes the first audio track of a media file into mono float samples, then writes
 * them out as 16 kHz signed 16-bit little-endian PCM.
 *
 * This is the only audio path in the app on purpose: every engine we benchmark and
 * ship sees byte-identical input, so a difference in output is a difference in the
 * model, not in how the audio reached it.
 */
internal object PcmDecoder {
  const val TARGET_SAMPLE_RATE = 16_000

  private const val DEQUEUE_TIMEOUT_US = 10_000L

  fun extractToPcm16File(context: Context, sourceUri: Uri, destination: File): ExtractedAudio {
    val decoded = decodeToMonoFloat(context, sourceUri)
    val resampled = Resampler.resample(decoded.samples, decoded.sampleRate, TARGET_SAMPLE_RATE)
    writePcm16(resampled, destination)

    return ExtractedAudio().apply {
      path = destination.absolutePath
      sampleRate = TARGET_SAMPLE_RATE
      channelCount = 1
      sampleCount = resampled.size
      durationMs = resampled.size * 1000.0 / TARGET_SAMPLE_RATE
      sourceSampleRate = decoded.sampleRate
      sourceChannelCount = decoded.channelCount
      byteLength = resampled.size * 2.0
    }
  }

  private fun decodeToMonoFloat(context: Context, sourceUri: Uri): DecodedAudio {
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null

    try {
      extractor.setDataSource(context, sourceUri, null)

      val trackIndex = (0 until extractor.trackCount).firstOrNull { index ->
        extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: throw NoAudioTrackException()

      extractor.selectTrack(trackIndex)
      val inputFormat = extractor.getTrackFormat(trackIndex)
      val mime = inputFormat.getString(MediaFormat.KEY_MIME)!!

      // Format values from the extractor are a starting point only. The decoder is
      // free to report something different once it has parsed the stream, so the
      // per-buffer output format below is what actually drives the conversion.
      var sampleRate = inputFormat.getIntegerOrNull(MediaFormat.KEY_SAMPLE_RATE) ?: TARGET_SAMPLE_RATE
      var channelCount = inputFormat.getIntegerOrNull(MediaFormat.KEY_CHANNEL_COUNT) ?: 1
      var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT

      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(inputFormat, null, null, 0)
      codec.start()

      val chunks = ArrayList<FloatArray>()
      var totalSamples = 0
      val bufferInfo = MediaCodec.BufferInfo()
      var sawInputEos = false
      var sawOutputEos = false

      while (!sawOutputEos) {
        if (!sawInputEos) {
          val inputIndex = codec.dequeueInputBuffer(DEQUEUE_TIMEOUT_US)
          if (inputIndex >= 0) {
            val inputBuffer = codec.getInputBuffer(inputIndex)!!
            val read = extractor.readSampleData(inputBuffer, 0)
            if (read < 0) {
              codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              sawInputEos = true
            } else {
              codec.queueInputBuffer(inputIndex, 0, read, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        when (val outputIndex = codec.dequeueOutputBuffer(bufferInfo, DEQUEUE_TIMEOUT_US)) {
          MediaCodec.INFO_TRY_AGAIN_LATER -> Unit

          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val format = codec.outputFormat
            sampleRate = format.getIntegerOrNull(MediaFormat.KEY_SAMPLE_RATE) ?: sampleRate
            channelCount = format.getIntegerOrNull(MediaFormat.KEY_CHANNEL_COUNT) ?: channelCount
            pcmEncoding = format.getIntegerOrNull(MediaFormat.KEY_PCM_ENCODING) ?: pcmEncoding
          }

          else -> {
            if (outputIndex >= 0) {
              val format = codec.getOutputFormat(outputIndex)
              sampleRate = format.getIntegerOrNull(MediaFormat.KEY_SAMPLE_RATE) ?: sampleRate
              channelCount = format.getIntegerOrNull(MediaFormat.KEY_CHANNEL_COUNT) ?: channelCount
              pcmEncoding = format.getIntegerOrNull(MediaFormat.KEY_PCM_ENCODING) ?: pcmEncoding

              if (bufferInfo.size > 0) {
                val outputBuffer = codec.getOutputBuffer(outputIndex)!!
                outputBuffer.position(bufferInfo.offset)
                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                val mono = toMonoFloat(outputBuffer, pcmEncoding, channelCount)
                if (mono.isNotEmpty()) {
                  chunks.add(mono)
                  totalSamples += mono.size
                }
              }

              codec.releaseOutputBuffer(outputIndex, false)
            }

            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              sawOutputEos = true
            }
          }
        }
      }

      val samples = FloatArray(totalSamples)
      var offset = 0
      for (chunk in chunks) {
        chunk.copyInto(samples, offset)
        offset += chunk.size
      }

      return DecodedAudio(samples, sampleRate, channelCount)
    } catch (error: expo.modules.kotlin.exception.CodedException) {
      throw error
    } catch (error: Throwable) {
      throw DecodeFailedException(error)
    } finally {
      try {
        codec?.stop()
      } catch (_: Throwable) {
        // A codec that never started throws on stop; nothing to recover here.
      }
      codec?.release()
      extractor.release()
    }
  }

  /** Collapses one decoded buffer to mono, normalising whatever PCM layout the codec chose. */
  private fun toMonoFloat(buffer: ByteBuffer, pcmEncoding: Int, channelCount: Int): FloatArray {
    val channels = max(1, channelCount)
    val ordered = buffer.order(ByteOrder.LITTLE_ENDIAN)

    return when (pcmEncoding) {
      AudioFormat.ENCODING_PCM_16BIT -> {
        val shorts = ordered.asShortBuffer()
        val frames = shorts.remaining() / channels
        FloatArray(frames) { frame ->
          var sum = 0f
          for (channel in 0 until channels) {
            sum += shorts.get(frame * channels + channel) / 32768f
          }
          sum / channels
        }
      }

      AudioFormat.ENCODING_PCM_FLOAT -> {
        val floats = ordered.asFloatBuffer()
        val frames = floats.remaining() / channels
        FloatArray(frames) { frame ->
          var sum = 0f
          for (channel in 0 until channels) {
            sum += floats.get(frame * channels + channel)
          }
          sum / channels
        }
      }

      AudioFormat.ENCODING_PCM_8BIT -> {
        val frames = ordered.remaining() / channels
        FloatArray(frames) { frame ->
          var sum = 0f
          for (channel in 0 until channels) {
            // 8-bit PCM is unsigned with 128 as silence.
            sum += ((ordered.get(frame * channels + channel).toInt() and 0xFF) - 128) / 128f
          }
          sum / channels
        }
      }

      else -> throw UnsupportedPcmEncodingException(pcmEncoding)
    }
  }

  private fun writePcm16(samples: FloatArray, destination: File) {
    destination.parentFile?.mkdirs()
    FileOutputStream(destination).use { stream ->
      val chunkFrames = 1 shl 15
      val bytes = ByteArray(chunkFrames * 2)
      var index = 0
      while (index < samples.size) {
        val frames = min(chunkFrames, samples.size - index)
        for (i in 0 until frames) {
          val clamped = min(1f, max(-1f, samples[index + i]))
          val value = (clamped * 32767f).roundToInt().coerceIn(-32768, 32767)
          bytes[i * 2] = (value and 0xFF).toByte()
          bytes[i * 2 + 1] = ((value shr 8) and 0xFF).toByte()
        }
        stream.write(bytes, 0, frames * 2)
        index += frames
      }
    }
  }

  private fun MediaFormat.getIntegerOrNull(key: String): Int? =
    if (containsKey(key)) getInteger(key) else null
}
