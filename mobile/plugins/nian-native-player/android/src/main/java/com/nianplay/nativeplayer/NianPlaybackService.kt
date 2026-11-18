package com.nianplay.nativeplayer

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Owns the ExoPlayer and its MediaSession. Media3 shows the playback notification (also on the
 * lock screen and in quick settings), keeps the service in the foreground while music plays, and
 * handles headset buttons / Bluetooth / "audio becoming noisy" (pauses when headphones unplug).
 *
 * The queue lives in the player itself: the JS side sends the current song + the next ones
 * (NianNativePlayerPlugin), and ExoPlayer advances on its own — also while the WebView's
 * JavaScript is paused in the background. Per-song volume (LUFS gain × app volume) and the
 * song's cut segments are applied here, from each item's extras.
 */
class NianPlaybackService : MediaSessionService() {
    private var session: MediaSession? = null
    private val handler = Handler(Looper.getMainLooper())

    // Skips the current song's cut segments (checked 4×/s)
    private val cutChecker = object : Runnable {
        override fun run() {
            val p = session?.player
            if (p != null && p.isPlaying) {
                val extras = p.currentMediaItem?.mediaMetadata?.extras
                val starts = extras?.getDoubleArray(EXTRA_CUT_STARTS)
                val ends = extras?.getDoubleArray(EXTRA_CUT_ENDS)
                if (starts != null && ends != null) {
                    val pos = p.currentPosition / 1000.0
                    for (i in starts.indices) {
                        if (i < ends.size && pos >= starts[i] && pos < ends[i]) {
                            var target = ((ends[i] + 0.05) * 1000).toLong()
                            if (p.duration != C.TIME_UNSET) target = minOf(target, p.duration)
                            p.seekTo(target)
                            break
                        }
                    }
                }
            }
            handler.postDelayed(this, 250)
        }
    }

    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build()

        player.addListener(object : Player.Listener {
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                val volume = mediaItem?.mediaMetadata?.extras?.getFloat(EXTRA_VOLUME, 1f) ?: 1f
                player.volume = volume.coerceIn(0f, 1f)
            }
        })

        val builder = MediaSession.Builder(this, player)
        packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
            val pending = PendingIntent.getActivity(
                this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            builder.setSessionActivity(pending)
        }
        val s = builder.build()
        session = s
        addSession(s)
        handler.post(cutChecker)

        instance = this
        val queued = waiting.toList()
        waiting.clear()
        queued.forEach { it(player) }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    // App swiped away from the recents: keep playing if music is on, otherwise end the service
    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = session?.player
        if (p == null || !p.playWhenReady || p.mediaItemCount == 0) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        session?.let {
            it.player.release()
            it.release()
        }
        session = null
        instance = null
        super.onDestroy()
    }

    val exoPlayer: ExoPlayer? get() = session?.player as? ExoPlayer

    companion object {
        const val EXTRA_VOLUME = "nian.volume"
        const val EXTRA_CUT_STARTS = "nian.cutStarts"
        const val EXTRA_CUT_ENDS = "nian.cutEnds"

        @Volatile var instance: NianPlaybackService? = null
        private val waiting = mutableListOf<(ExoPlayer) -> Unit>()

        /** Runs [fn] on the main thread with the player, starting the service first if needed. */
        fun withPlayer(context: Context, fn: (ExoPlayer) -> Unit) {
            Handler(Looper.getMainLooper()).post {
                val p = instance?.exoPlayer
                if (p != null) {
                    fn(p)
                } else {
                    waiting.add(fn)
                    context.startService(Intent(context, NianPlaybackService::class.java))
                }
            }
        }
    }
}
