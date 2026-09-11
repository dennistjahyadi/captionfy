package expo.modules.spikemetrics

import android.app.ActivityManager
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

class DeviceProfile : Record {
  @Field var label: String = ""
  @Field var model: String = ""
  @Field var soc: String = ""
  @Field var osVersion: String = ""
  @Field var abi: String = ""
  @Field var cpuCores: Int = 0
  @Field var totalRamMb: Int = 0
}

class SourceInfo : Record {
  @Field var name: String = ""
  @Field var sizeBytes: Double = 0.0
  @Field var readable: Boolean = false
}

/**
 * Throwaway Phase 0 instrumentation. Delete this module together with `spike/`
 * once the Stage 0 accuracy question is answered; nothing in the shipped app
 * should depend on it.
 */
class SpikeMetricsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SpikeMetrics")

    Function("getDeviceProfile") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val memoryInfo = ActivityManager.MemoryInfo()
      (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
        .getMemoryInfo(memoryInfo)

      val soc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        "${Build.SOC_MANUFACTURER} ${Build.SOC_MODEL}".trim()
      } else {
        Build.HARDWARE
      }

      DeviceProfile().apply {
        model = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
        this.soc = soc
        osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
        abi = Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"
        cpuCores = Runtime.getRuntime().availableProcessors()
        totalRamMb = (memoryInfo.totalMem / (1024 * 1024)).toInt()
        label = "$model / $soc / $abi"
      }
    }

    /**
     * Peak resident set size since process start, or since the last successful
     * [resetPeakRss], read from VmHWM in /proc/self/status. Returns 0 when the
     * kernel does not expose it.
     */
    Function("getPeakRssBytes") {
      readProcStatusKb("VmHWM:")?.let { it * 1024L } ?: 0L
    }

    Function("getCurrentRssBytes") {
      readProcStatusKb("VmRSS:")?.let { it * 1024L } ?: 0L
    }

    /**
     * Asks the kernel to reset the VmHWM watermark so each model run reports its
     * own peak rather than the high water mark of every run before it. Returns
     * false when the kernel refuses, in which case peaks are cumulative and the
     * caller should say so.
     */
    Function("resetPeakRss") {
      try {
        File("/proc/self/clear_refs").writeText("5")
        true
      } catch (_: Throwable) {
        false
      }
    }

    /**
     * Real display name and size behind a picked `content://` URI, plus whether it
     * can still be opened.
     *
     * A document URI carries a provider id, not a filename, so the picked clip
     * would otherwise land in the CSV as something like `msf:1000000045`. Only the
     * provider knows the name, and it only answers over the resolver. `readable`
     * reports whether a remembered URI still works: SAF grants survive a restart,
     * but not the file being deleted or the grant being revoked.
     */
    AsyncFunction("describeSource") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val parsed = Uri.parse(uri)
      val info = SourceInfo()

      if (parsed.scheme == "content") {
        try {
          context.contentResolver
            .query(parsed, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
            ?.use { cursor ->
              if (cursor.moveToFirst()) {
                cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                  .takeIf { it >= 0 && !cursor.isNull(it) }
                  ?.let { info.name = cursor.getString(it) }
                cursor.getColumnIndex(OpenableColumns.SIZE)
                  .takeIf { it >= 0 && !cursor.isNull(it) }
                  ?.let { info.sizeBytes = cursor.getLong(it).toDouble() }
              }
            }
          // A query can be answered out of a cache after the grant is gone, so
          // readability is decided by actually opening the thing.
          context.contentResolver.openInputStream(parsed)?.use { info.readable = true }
        } catch (_: Throwable) {
          info.readable = false
        }
        return@AsyncFunction info
      }

      val file = File(parsed.path ?: uri)
      info.name = file.name
      info.sizeBytes = file.length().toDouble()
      info.readable = file.canRead()
      info
    }

    /**
     * Writes to the `Caption` logcat tag so a release build can be read with
     * `adb logcat -s RNWhisper:* Caption:*`. JS `console.log` is not dependable
     * once the bundle is minified, and the Stage 0 numbers only count in release.
     */
    Function("log") { message: String ->
      // logcat drops anything past roughly 4 kB in a single entry.
      message.chunked(3000).forEach { chunk -> android.util.Log.i("Caption", chunk) }
    }
  }

  private fun readProcStatusKb(key: String): Long? = try {
    File("/proc/self/status").useLines { lines ->
      lines.firstOrNull { it.startsWith(key) }
        ?.substringAfter(key)
        ?.trim()
        ?.removeSuffix(" kB")
        ?.trim()
        ?.toLongOrNull()
    }
  } catch (_: Throwable) {
    null
  }
}
