package com.nianplay.nativeplayer

import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * Same API and events as the iOS plugin (ios/Sources/NianNativePlayerPlugin), used by
 * mobile/src/platform/nativeAudio.js:
 *   open({ url, title, artist, album, artwork, volume, cuts, startAt, autoplay })
 *   setUpcoming({ items }) · play() · pause() · seek({ time }) · setVolume({ volume }) · getState()
 * Events: time, ready, state, advanced, queueEnded, error.
 *
 * The player's playlist = up to 50 songs already played (lock-screen "previous") + the current song
 * + the upcoming ones. Item id = its file:// URL (the JS side identifies songs by it).
 */
@CapacitorPlugin(name = "NianNativePlayer")
class NianNativePlayerPlugin : Plugin() {
    private val main = Handler(Looper.getMainLooper())
    private var attached: ExoPlayer? = null
    private var appVisible = true
    private var lastPlaying: Boolean? = null
    // An item change we caused ourselves (open) is not reported back as "advanced"
    private var ownTransitionTo: String? = null

    private val listener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val id = mediaItem?.mediaId ?: return
            if (id == ownTransitionTo) {
                ownTransitionTo = null
                return
            }
            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_PLAYLIST_CHANGED) return
            notifyListeners("advanced", JSObject().put("url", id))
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) = emitState()
        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) = emitState()

        override fun onPlaybackStateChanged(state: Int) {
            val p = attached ?: return
            val id = p.currentMediaItem?.mediaId ?: ""
            when (state) {
                Player.STATE_READY -> notifyListeners("ready", JSObject().put("url", id).put("duration", durationSec(p)))
                Player.STATE_ENDED -> notifyListeners("queueEnded", JSObject().put("url", id))
            }
            emitState()
        }

        override fun onPlayerError(error: PlaybackException) {
            val p = attached ?: return
            notifyListeners("error", JSObject()
                .put("url", p.currentMediaItem?.mediaId ?: "")
                .put("message", error.message ?: "Falha ao abrir o arquivo"))
            // A broken file must not stop the music: go on with the next one
            if (p.hasNextMediaItem()) {
                p.seekToNextMediaItem()
                p.prepare()
                p.play()
            }
        }
    }

    // Position for the UI (only while the app is visible: the WebView is paused in the background)
    private val ticker = object : Runnable {
        override fun run() {
            val p = attached
            if (p != null && appVisible && p.isPlaying) {
                notifyListeners("time", JSObject()
                    .put("url", p.currentMediaItem?.mediaId ?: "")
                    .put("currentTime", p.currentPosition / 1000.0)
                    .put("duration", durationSec(p)))
            }
            main.postDelayed(this, 250)
        }
    }

    override fun load() {
        main.post(ticker)
    }

    override fun handleOnResume() { appVisible = true }
    override fun handleOnPause() { appVisible = false }

    override fun handleOnDestroy() {
        main.removeCallbacks(ticker)
        attached?.removeListener(listener)
        attached = null
    }

    private fun player(fn: (ExoPlayer) -> Unit) {
        NianPlaybackService.withPlayer(context) { p ->
            if (attached !== p) {
                attached?.removeListener(listener)
                p.addListener(listener)
                attached = p
            }
            fn(p)
        }
    }

    private fun emitState() {
        val p = attached ?: return
        val playing = p.isPlaying || (p.playWhenReady && p.playbackState == Player.STATE_BUFFERING)
        if (playing != lastPlaying) {
            lastPlaying = playing
            notifyListeners("state", JSObject().put("playing", playing))
        }
    }

    private fun durationSec(p: Player): Double =
        if (p.duration == C.TIME_UNSET || p.duration < 0) 0.0 else p.duration / 1000.0

    // ── items ──
    private fun itemFrom(o: JSONObject): MediaItem? {
        val url = o.optString("url", "")
        if (url.isEmpty()) return null
        val extras = Bundle()
        extras.putFloat(NianPlaybackService.EXTRA_VOLUME, o.optDouble("volume", 1.0).toFloat().coerceIn(0f, 1f))
        val cuts = o.optJSONArray("cuts")
        if (cuts != null && cuts.length() > 0) {
            val pairs = (0 until cuts.length())
                .mapNotNull { cuts.optJSONObject(it) }
                .map { it.optDouble("start", 0.0) to it.optDouble("end", 0.0) }
                .filter { it.second > it.first }
                .sortedBy { it.first }
            extras.putDoubleArray(NianPlaybackService.EXTRA_CUT_STARTS, pairs.map { it.first }.toDoubleArray())
            extras.putDoubleArray(NianPlaybackService.EXTRA_CUT_ENDS, pairs.map { it.second }.toDoubleArray())
        }
        val meta = MediaMetadata.Builder()
            .setTitle(o.optString("title", ""))
            .setArtist(o.optString("artist", ""))
            .setAlbumTitle(o.optString("album", ""))
            .setExtras(extras)
        val artwork = o.optString("artwork", "")
        if (artwork.isNotEmpty()) meta.setArtworkUri(Uri.parse(artwork))
        return MediaItem.Builder()
            .setMediaId(url)
            .setUri(Uri.parse(url))
            .setMediaMetadata(meta.build())
            .build()
    }

    // ── JS API ──
    @PluginMethod
    fun open(call: PluginCall) {
        val item = itemFrom(call.data)
        if (item == null) {
            call.reject("Invalid audio url")
            return
        }
        val startMs = ((call.getDouble("startAt") ?: 0.0) * 1000).toLong()
        val autoplay = call.getBoolean("autoplay", true) ?: true
        player { p ->
            val count = p.mediaItemCount
            val cur = p.currentMediaItemIndex
            if (count == 0 || cur < 0) {
                p.setMediaItem(item, startMs)   // reported as PLAYLIST_CHANGED, which is ignored
            } else if (p.currentMediaItem?.mediaId == item.mediaId) {
                p.replaceMediaItem(cur, item)
                p.seekTo(cur, startMs)
            } else {
                if (cur + 1 < count) p.removeMediaItems(cur + 1, count)
                p.addMediaItem(item)
                ownTransitionTo = item.mediaId
                p.seekTo(p.mediaItemCount - 1, startMs)
                // Keep at most 50 songs of history
                val extra = p.currentMediaItemIndex - 50
                if (extra > 0) p.removeMediaItems(0, extra)
            }
            p.volume = item.mediaMetadata.extras?.getFloat(NianPlaybackService.EXTRA_VOLUME, 1f) ?: 1f
            p.prepare()
            p.playWhenReady = autoplay
            call.resolve()
        }
    }

    @PluginMethod
    fun setUpcoming(call: PluginCall) {
        val arr = call.getArray("items")
        val items = mutableListOf<MediaItem>()
        if (arr != null) {
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { itemFrom(it) }?.let { items.add(it) }
            }
        }
        player { p ->
            val count = p.mediaItemCount
            val cur = p.currentMediaItemIndex
            if (count > 0 && cur >= 0) {
                if (cur + 1 < count) p.removeMediaItems(cur + 1, count)
                p.addMediaItems(items)
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        player { p ->
            if (p.playbackState == Player.STATE_IDLE) p.prepare()
            if (p.playbackState == Player.STATE_ENDED) p.seekTo(p.currentMediaItemIndex, 0)
            p.play()
            call.resolve()
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        player { p ->
            p.pause()
            call.resolve()
        }
    }

    @PluginMethod
    fun seek(call: PluginCall) {
        val ms = ((call.getDouble("time") ?: 0.0) * 1000).toLong().coerceAtLeast(0)
        player { p ->
            p.seekTo(ms)
            call.resolve()
        }
    }

    @PluginMethod
    fun setVolume(call: PluginCall) {
        val v = (call.getDouble("volume") ?: 1.0).toFloat().coerceIn(0f, 1f)
        player { p ->
            p.volume = v
            call.resolve()
        }
    }

    @PluginMethod
    fun getState(call: PluginCall) {
        player { p ->
            call.resolve(JSObject()
                .put("url", p.currentMediaItem?.mediaId ?: "")
                .put("currentTime", p.currentPosition / 1000.0)
                .put("duration", durationSec(p))
                .put("playing", p.isPlaying || (p.playWhenReady && p.playbackState == Player.STATE_BUFFERING)))
        }
    }
}
