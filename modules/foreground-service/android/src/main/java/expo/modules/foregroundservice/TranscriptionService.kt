package expo.modules.foregroundservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * The notification Android charges for staying alive, and nothing else.
 *
 * Transcription runs on the JS thread. This service exists so the system does
 * not freeze that thread the moment the user switches apps, which is exactly the
 * failure other caption apps are reviewed badly for: leave the app for half a
 * minute and the job is gone.
 */
class TranscriptionService : Service() {
  companion object {
    const val ACTION_START = "captionfy.transcription.START"
    const val ACTION_UPDATE = "captionfy.transcription.UPDATE"
    const val EXTRA_TEXT = "text"
    const val EXTRA_PERCENT = "percent"

    private const val CHANNEL_ID = "captionfy.transcription"
    private const val NOTIFICATION_ID = 4201
  }

  private var text: String = "Captioning your video"
  private var started = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    intent?.getStringExtra(EXTRA_TEXT)?.let { text = it }
    val percent = intent?.getIntExtra(EXTRA_PERCENT, 0) ?: 0

    createChannel()
    val notification = buildNotification(percent)

    if (!started) {
      // Android 15 added mediaProcessing, which is what this work is. The type
      // does not exist below it, and dataSync is the nearest thing the platform
      // offers, so the choice is made here rather than in the manifest.
      //
      // Called on the platform directly rather than through ServiceCompat, which
      // masks the requested type against the ones it recognises and hands the
      // framework a bare zero for mediaProcessing. The framework then refuses to
      // start a typed service with no type.
      //
      // Wrapped, because every refusal the platform can invent here is thrown on
      // the main thread and takes the whole app with it. A transcription that
      // runs without a notification is worth more than a clip the user loses.
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val type =
            if (Build.VERSION.SDK_INT >= 35) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
            else ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
          startForeground(NOTIFICATION_ID, notification, type)
        } else {
          startForeground(NOTIFICATION_ID, notification)
        }
        started = true
      } catch (error: Throwable) {
        Log.w("Captionfy", "Foreground service refused: ${error.message}")
        stopSelf()
      }
    } else {
      val manager = getSystemService(NotificationManager::class.java)
      manager?.notify(NOTIFICATION_ID, notification)
    }

    // The work is the app's, not the service's. Restarting this without the app
    // would show a progress bar for a job nobody is running.
    return START_NOT_STICKY
  }

  /**
   * Android 15 gives a typed foreground service a time budget and calls this when
   * it runs out. Stopping here is not optional: a service that ignores the call
   * is killed with an ANR. The transcription itself carries on while the app is
   * open, and every finished chunk is already on disk.
   */
  override fun onTimeout(startId: Int, fgsType: Int) {
    Log.w("Captionfy", "Foreground service timed out, type $fgsType")
    stopSelf()
  }

  override fun onDestroy() {
    started = false
    super.onDestroy()
  }

  private fun buildNotification(percent: Int): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pending = launch?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("$text · $percent%")
      .setContentText("Tap to return")
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setProgress(100, percent.coerceIn(0, 100), false)
      .setOngoing(true)
      .setSilent(true)
      .setContentIntent(pending)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Captioning",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Progress while a video is being captioned"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }
}
