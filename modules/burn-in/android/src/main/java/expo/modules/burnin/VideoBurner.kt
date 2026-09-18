package expo.modules.burnin

import android.content.Context
import android.graphics.Bitmap
import android.graphics.SurfaceTexture
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.min
import kotlin.math.roundToInt

internal class NoVideoTrackException :
  expo.modules.kotlin.exception.CodedException("That file has no video in it")

internal class CancelledException :
  expo.modules.kotlin.exception.CodedException("The export was cancelled")

internal class EncoderException(cause: Throwable) :
  expo.modules.kotlin.exception.CodedException(
    "Couldn't render this video on this phone. Try 720p.",
    cause,
  )

/**
 * The burn-in: source video in, captioned video out.
 *
 * Decoder to an external texture, GL to the encoder's input surface, encoder to
 * the muxer, with the audio track copied across untouched. No frame is ever
 * decoded to the CPU and no pixel is ever read back, which is what makes this
 * fast enough to be worth doing on a phone.
 *
 * Every frame keeps the presentation time it arrived with, so a clip's own frame
 * rate — including a variable one — is what comes out the other end.
 */
internal class VideoBurner(
  private val context: Context,
  private val source: Uri,
  private val plan: BurnPlan,
  private val output: File,
  private val cancelled: AtomicBoolean,
  private val onProgress: (Double) -> Unit,
) {
  private val painter = CaptionPainter(context.assets)

  fun run(): BurnResult {
    output.parentFile?.mkdirs()
    if (output.exists()) output.delete()

    val extractor = MediaExtractor()
    var decoder: MediaCodec? = null
    var encoder: MediaCodec? = null
    var muxer: MediaMuxer? = null
    var scene: GlScene? = null
    var surfaceTexture: SurfaceTexture? = null
    var decoderSurface: Surface? = null
    var encoderSurface: Surface? = null
    val frames = HandlerThread("burn-in-frames").apply { start() }

    try {
      extractor.setDataSource(context, source, null)
      val videoTrack = trackStartingWith(extractor, "video/") ?: throw NoVideoTrackException()
      val audioTrack = trackStartingWith(extractor, "audio/")
      val inputFormat = extractor.getTrackFormat(videoTrack)
      val rotation = inputFormat.optInt(MediaFormat.KEY_ROTATION) ?: 0
      val sourceDurationMs = (inputFormat.optLong(MediaFormat.KEY_DURATION) ?: 0L) / 1000

      encoder = MediaCodec.createEncoderByType(MIME_VIDEO)
      encoder.configure(encoderFormat(), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      encoderSurface = encoder.createInputSurface()
      encoder.start()

      scene = GlScene(encoderSurface, plan.width, plan.height)
      scene.setRotation(rotation)

      val ready = FrameGate()
      surfaceTexture = SurfaceTexture(scene.videoTextureId).apply {
        setOnFrameAvailableListener({ ready.signal() }, Handler(frames.looper))
      }
      decoderSurface = Surface(surfaceTexture)

      extractor.selectTrack(videoTrack)
      decoder = MediaCodec.createDecoderByType(inputFormat.getString(MediaFormat.KEY_MIME)!!)
      decoder.configure(inputFormat, decoderSurface, null, 0)
      decoder.start()

      muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)

      val written = transcode(
        extractor = extractor,
        decoder = decoder,
        encoder = encoder,
        muxer = muxer,
        scene = scene,
        surfaceTexture = surfaceTexture,
        ready = ready,
        audioFormat = audioTrack?.let { extractor.getTrackFormat(it) },
        durationMs = if (sourceDurationMs > 0) sourceDurationMs else plan.durationMs,
      )

      if (audioTrack != null && written.audioTrackIndex >= 0) {
        copyAudio(muxer, written.audioTrackIndex)
      }

      muxer.stop()

      return BurnResult().apply {
        path = output.absolutePath
        width = plan.width
        height = plan.height
        byteLength = output.length().toDouble()
        frameCount = written.frames
        durationMs = written.lastPresentationMs.toDouble()
        hasAudio = written.audioTrackIndex >= 0
      }
    } catch (error: expo.modules.kotlin.exception.CodedException) {
      output.delete()
      throw error
    } catch (error: Throwable) {
      output.delete()
      throw EncoderException(error)
    } finally {
      // Torn down in the order things depend on each other, and nothing here is
      // allowed to throw over the error that brought us here.
      quietly { decoder?.stop() }
      quietly { decoder?.release() }
      quietly { encoder?.stop() }
      quietly { encoder?.release() }
      quietly { scene?.release() }
      quietly { decoderSurface?.release() }
      quietly { encoderSurface?.release() }
      quietly { surfaceTexture?.release() }
      quietly { muxer?.release() }
      quietly { extractor.release() }
      frames.quitSafely()
    }
  }

  private data class Written(
    val frames: Int,
    val lastPresentationMs: Long,
    val audioTrackIndex: Int,
  )

  private fun transcode(
    extractor: MediaExtractor,
    decoder: MediaCodec,
    encoder: MediaCodec,
    muxer: MediaMuxer,
    scene: GlScene,
    surfaceTexture: SurfaceTexture,
    ready: FrameGate,
    audioFormat: MediaFormat?,
    durationMs: Long,
  ): Written {
    val overlay = Bitmap.createBitmap(plan.width, plan.height, Bitmap.Config.ARGB_8888)
    val textureMatrix = FloatArray(16)
    // One per codec. MediaCodec leaves a BufferInfo untouched when it hands back
    // a negative index, so sharing one would silently carry the other codec's
    // flags into a branch that never looked at the index.
    val decoded = MediaCodec.BufferInfo()
    val encoded = MediaCodec.BufferInfo()

    var videoTrackIndex = -1
    var audioTrackIndex = -1
    var muxing = false

    var entryShowing = -1
    var frames = 0
    var lastPresentationMs = 0L
    var sawInputEos = false
    var sawDecoderEos = false
    var sawEncoderEos = false
    var reported = -1.0

    while (!sawEncoderEos) {
      if (cancelled.get()) throw CancelledException()

      if (!sawInputEos) {
        val index = decoder.dequeueInputBuffer(TIMEOUT_US)
        if (index >= 0) {
          val buffer = decoder.getInputBuffer(index)!!
          val read = extractor.readSampleData(buffer, 0)
          if (read < 0) {
            decoder.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            sawInputEos = true
          } else {
            decoder.queueInputBuffer(index, 0, read, extractor.sampleTime, 0)
            extractor.advance()
          }
        }
      }

      if (!sawDecoderEos) {
        when (val index = decoder.dequeueOutputBuffer(decoded, TIMEOUT_US)) {
          MediaCodec.INFO_TRY_AGAIN_LATER, MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> Unit

          else -> {
            if (index >= 0) {
              val render = decoded.size > 0
              val presentationUs = decoded.presentationTimeUs
              decoder.releaseOutputBuffer(index, render)

              if (render) {
                ready.await()
                surfaceTexture.updateTexImage()
                surfaceTexture.getTransformMatrix(textureMatrix)

                val presentationMs = presentationUs / 1000
                val wanted = plan.entryAt(presentationMs, maxOf(entryShowing, 0))
                if (wanted != entryShowing) {
                  painter.paint(overlay, plan.entries[wanted], plan.watermark)
                  scene.uploadOverlay(overlay)
                  entryShowing = wanted
                }

                scene.drawVideo(textureMatrix)
                scene.drawOverlay()
                scene.present(presentationUs * 1000)

                frames += 1
                lastPresentationMs = presentationMs

                val done = if (durationMs > 0) min(1.0, presentationMs.toDouble() / durationMs) else 0.0
                // Reported in whole percents: a progress bar that redraws four
                // thousand times is four thousand renders the encoder did not get.
                if (done - reported >= 0.01) {
                  reported = done
                  onProgress(done)
                }
              }

              if (decoded.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                sawDecoderEos = true
                encoder.signalEndOfInputStream()
              }
            }
          }
        }
      }

      when (val index = encoder.dequeueOutputBuffer(encoded, TIMEOUT_US)) {
        MediaCodec.INFO_TRY_AGAIN_LATER -> Unit

        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          // Every track has to be added before the muxer starts, and the video
          // format is only knowable once the encoder has produced it.
          videoTrackIndex = muxer.addTrack(encoder.outputFormat)
          if (audioFormat != null) audioTrackIndex = muxer.addTrack(audioFormat)
          muxer.start()
          muxing = true
        }

        else -> {
          if (index >= 0) {
            val buffer = encoder.getOutputBuffer(index)!!
            val codecConfig = encoded.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
            if (encoded.size > 0 && muxing && !codecConfig) {
              buffer.position(encoded.offset)
              buffer.limit(encoded.offset + encoded.size)
              muxer.writeSampleData(videoTrackIndex, buffer, encoded)
            }
            encoder.releaseOutputBuffer(index, false)

            if (encoded.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawEncoderEos = true
          }
        }
      }
    }

    overlay.recycle()
    onProgress(1.0)
    return Written(frames, lastPresentationMs, audioTrackIndex)
  }

  /**
   * Copies the audio across without re-encoding it.
   *
   * The user's voice is the one thing in this file that was already exactly
   * right, and a second lossy pass over it would be damage for nothing.
   */
  private fun copyAudio(muxer: MediaMuxer, outputTrack: Int) {
    // Its own extractor: the video one is mid-stream with a track selected, and
    // an audio pass that had to reason about where it left off would be a second
    // kind of state to get wrong.
    val extractor = MediaExtractor()

    try {
      extractor.setDataSource(context, source, null)
      val track = trackStartingWith(extractor, "audio/") ?: return
      extractor.selectTrack(track)

      val buffer = ByteBuffer.allocateDirect(AUDIO_BUFFER_BYTES)
      val info = MediaCodec.BufferInfo()

      while (true) {
        if (cancelled.get()) throw CancelledException()

        val read = extractor.readSampleData(buffer, 0)
        if (read < 0) break

        info.offset = 0
        info.size = read
        info.presentationTimeUs = extractor.sampleTime
        info.flags = if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) {
          MediaCodec.BUFFER_FLAG_KEY_FRAME
        } else {
          0
        }

        muxer.writeSampleData(outputTrack, buffer, info)
        extractor.advance()
      }
    } finally {
      quietly { extractor.release() }
    }
  }

  private fun encoderFormat(): MediaFormat =
    MediaFormat.createVideoFormat(MIME_VIDEO, plan.width, plan.height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, bitrate())
      setInteger(MediaFormat.KEY_FRAME_RATE, plan.fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, KEYFRAME_SECONDS)
    }

  /**
   * Bits per second, from the size and rate of what is being written.
   *
   * Captions are hard edges on top of camera footage, and hard edges are what a
   * starved encoder smears first. This is deliberately generous: a phone export
   * is watched once and uploaded, and the platform will re-encode it anyway.
   *
   * `checkSpace` in src/export/run.ts mirrors these three numbers to answer
   * "will this fit" before the encoder starts. Change them here and change them
   * there.
   */
  private fun bitrate(): Int =
    (plan.width.toLong() * plan.height * plan.fps * BITS_PER_PIXEL)
      .toDouble()
      .roundToInt()
      .coerceIn(2_000_000, 20_000_000)

  private fun trackStartingWith(extractor: MediaExtractor, prefix: String): Int? =
    (0 until extractor.trackCount).firstOrNull { index ->
      extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith(prefix) == true
    }

  private fun MediaFormat.optInt(key: String): Int? = if (containsKey(key)) getInteger(key) else null
  private fun MediaFormat.optLong(key: String): Long? = if (containsKey(key)) getLong(key) else null

  private inline fun quietly(block: () -> Unit) {
    try {
      block()
    } catch (_: Throwable) {
      // Teardown failures are never the interesting error.
    }
  }

  /** Waits for the decoder's next frame to actually land on the texture. */
  private class FrameGate {
    private val lock = Object()
    private var available = false

    fun signal() {
      synchronized(lock) {
        available = true
        lock.notifyAll()
      }
    }

    fun await() {
      synchronized(lock) {
        val deadline = System.currentTimeMillis() + FRAME_TIMEOUT_MS
        while (!available) {
          val left = deadline - System.currentTimeMillis()
          if (left <= 0) throw GlException("the decoder stopped producing frames")
          lock.wait(left)
        }
        available = false
      }
    }
  }

  private companion object {
    const val MIME_VIDEO = "video/avc"
    const val TIMEOUT_US = 10_000L
    const val FRAME_TIMEOUT_MS = 5_000L
    const val KEYFRAME_SECONDS = 1
    const val BITS_PER_PIXEL = 0.13
    const val AUDIO_BUFFER_BYTES = 512 * 1024
  }
}
