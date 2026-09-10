package expo.modules.audioextract

import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

class ExtractedAudio : Record {
  @Field var path: String = ""
  @Field var sampleRate: Int = 0
  @Field var channelCount: Int = 0
  @Field var sampleCount: Int = 0
  @Field var durationMs: Double = 0.0
  @Field var sourceSampleRate: Int = 0
  @Field var sourceChannelCount: Int = 0
  @Field var byteLength: Double = 0.0
}

class AudioExtractModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioExtract")

    // AsyncFunction runs off the JS thread, so a 60 second clip never stalls the UI.
    AsyncFunction("extractPcm16") { sourceUri: String, destinationPath: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      PcmDecoder.extractToPcm16File(context, Uri.parse(sourceUri), File(destinationPath))
    }
  }
}
