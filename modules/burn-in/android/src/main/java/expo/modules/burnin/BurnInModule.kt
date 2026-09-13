package expo.modules.burnin

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class BurnResult : Record {
  @Field var path: String = ""
  @Field var width: Int = 0
  @Field var height: Int = 0
  @Field var byteLength: Double = 0.0
  @Field var frameCount: Int = 0
  @Field var durationMs: Double = 0.0
  @Field var hasAudio: Boolean = false
}

class SavedFile : Record {
  @Field var uri: String = ""
  @Field var name: String = ""
  @Field var byteLength: Double = 0.0
}

class VideoInfo : Record {
  /** Upright, with any rotation metadata already applied. */
  @Field var width: Int = 0
  @Field var height: Int = 0
  @Field var rotation: Int = 0
  @Field var fps: Double = 0.0
  @Field var durationMs: Double = 0.0
  @Field var hasAudio: Boolean = false
}

internal class PublishException(message: String) :
  expo.modules.kotlin.exception.CodedException(message)

/**
 * Captions burned into the video.
 *
 * The module decides nothing about how a caption looks: it is handed a draw list
 * per moment, produced by the one layout in JavaScript at this export's own pixel
 * size, and it rasterises and muxes. See `BurnPlan.kt`.
 */
class BurnInModule : Module() {
  private val cancelled = AtomicBoolean(false)

  override fun definition() = ModuleDefinition {
    Name("BurnIn")

    Events("progress")

    AsyncFunction("probe") { sourceUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      Probe.read(context, Uri.parse(sourceUri))
    }

    // Runs off the JS thread: this is minutes of encoding, not milliseconds.
    AsyncFunction("render") { sourceUri: String, planPath: String, outputPath: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      cancelled.set(false)

      VideoBurner(
        context = context,
        source = Uri.parse(sourceUri),
        plan = PlanReader.read(planPath),
        output = File(outputPath),
        cancelled = cancelled,
      ) { done -> sendEvent("progress", mapOf("done" to done)) }.run()
    }

    /** Asks the render to stop. It stops at the next frame and deletes its file. */
    Function("cancel") {
      cancelled.set(true)
    }

    /**
     * The sidecar subtitle file, which belongs where a person looks for a download.
     *
     * The video goes through `expo-media-library`. A subtitle file is not media
     * and no media library will take one, so this is the one thing the module
     * still publishes itself.
     */
    AsyncFunction("saveToDownloads") { path: String, displayName: String, mimeType: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      publish(
        context,
        File(path),
        displayName,
        mimeType,
        MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
        Environment.DIRECTORY_DOWNLOADS + "/" + ALBUM,
      )
    }
  }

  /**
   * Copies a finished file into a public collection.
   *
   * Android 10 brought scoped storage, and with it the ability to write into a
   * shared collection with no permission at all, which is why the subtitle file
   * takes this route rather than asking for storage access of its own.
   */
  private fun publish(
    context: Context,
    file: File,
    displayName: String,
    mimeType: String,
    collection: Uri,
    relativePath: String,
  ): SavedFile {
    if (!file.exists()) throw PublishException("The rendered file is gone")
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      throw PublishException("Saving a subtitle file needs Android 10 or newer")
    }

    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
      put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }

    val resolver = context.contentResolver
    val uri = resolver.insert(collection, values)
      ?: throw PublishException("The phone would not accept the file")

    try {
      resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } }
        ?: throw PublishException("The phone would not accept the file")
    } catch (error: Throwable) {
      resolver.delete(uri, null, null)
      throw error
    }

    // Until this clears, the file is invisible to every other app. A half
    // written video showing up in the gallery is worse than a slow one.
    resolver.update(
      uri,
      ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) },
      null,
      null,
    )

    return SavedFile().apply {
      this.uri = uri.toString()
      name = displayName
      byteLength = file.length().toDouble()
    }
  }

  private companion object {
    const val ALBUM = "Captionfy"
  }
}
