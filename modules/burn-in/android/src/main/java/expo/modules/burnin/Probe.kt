package expo.modules.burnin

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri

internal class UnreadableVideoException(cause: Throwable) :
  expo.modules.kotlin.exception.CodedException("That video could not be read", cause)

/**
 * What the Export screen prints before anything is rendered.
 *
 * The size is the upright one: a phone recording carries its rotation in
 * metadata, so the track is often 1920 by 1080 for a video every human being
 * involved would call portrait. Saying "1920 × 1080" about it would be true of
 * the file and wrong about the video.
 */
internal object Probe {
  fun read(context: Context, source: Uri): VideoInfo {
    val extractor = MediaExtractor()

    try {
      extractor.setDataSource(context, source, null)

      val track = (0 until extractor.trackCount).firstOrNull { index ->
        extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
      } ?: throw NoVideoTrackException()

      val format = extractor.getTrackFormat(track)
      val hasAudio = (0 until extractor.trackCount).any { index ->
        extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      }

      val rotation = format.optInt(MediaFormat.KEY_ROTATION) ?: 0
      val trackWidth = format.getInteger(MediaFormat.KEY_WIDTH)
      val trackHeight = format.getInteger(MediaFormat.KEY_HEIGHT)
      val upright = rotation == 90 || rotation == 270
      val durationMs = (format.optLong(MediaFormat.KEY_DURATION) ?: 0L) / 1000.0

      return VideoInfo().apply {
        width = if (upright) trackHeight else trackWidth
        height = if (upright) trackWidth else trackHeight
        this.rotation = rotation
        this.durationMs = durationMs
        this.hasAudio = hasAudio
        fps = frameRate(context, source, format, durationMs)
      }
    } catch (error: expo.modules.kotlin.exception.CodedException) {
      throw error
    } catch (error: Throwable) {
      throw UnreadableVideoException(error)
    } finally {
      try {
        extractor.release()
      } catch (_: Throwable) {
        // Nothing to recover.
      }
    }
  }

  /**
   * The clip's real frame rate, from whichever source actually knows it.
   *
   * The track format usually carries it. When it does not, counting the frames
   * and dividing by the duration is exact for a fixed-rate clip and honest for a
   * variable-rate one. Thirty is the last resort and only affects what the
   * encoder is told to aim for; every frame keeps its own timestamp regardless.
   */
  private fun frameRate(
    context: Context,
    source: Uri,
    format: MediaFormat,
    durationMs: Double,
  ): Double {
    format.optInt(MediaFormat.KEY_FRAME_RATE)?.let { if (it > 0) return it.toDouble() }

    if (durationMs > 0) {
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(context, source)
        val frames = retriever
          .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)
          ?.toIntOrNull()
        if (frames != null && frames > 0) return frames * 1000.0 / durationMs
      } catch (_: Throwable) {
        // Fall through to the default.
      } finally {
        try {
          retriever.release()
        } catch (_: Throwable) {
          // Nothing to recover.
        }
      }
    }

    return 30.0
  }

  private fun MediaFormat.optInt(key: String): Int? = if (containsKey(key)) getInteger(key) else null
  private fun MediaFormat.optLong(key: String): Long? = if (containsKey(key)) getLong(key) else null
}
