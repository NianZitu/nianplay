package com.nianplay.youtube

import android.content.Context
import android.os.PowerManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

/**
 * YouTube on the phone, with the same yt-dlp the desktop app uses (src/main/handlers/downloader.js
 * and ytSearch.js), run by youtubedl-android.
 *
 *   status()                       → { ready, version, error }
 *   update()                       → { status, version }   (yt-dlp from its stable channel; YouTube changes often)
 *   search({ query, limit })       → { out }               (one JSON object per line, parsed in JS)
 *   download({ id, url, playlist }) → resolves at once; then events:
 *        "progress" { id, percent, eta, title? }
 *        "file"     { id, url, path }   — a finished song (moved into <external files>/YouTube)
 *        "done"     { id, ok, cancelled, error }
 *   cancel({ id })
 *
 * Downloads run one at a time. Files are made in the cache folder and only moved into the visible
 * folder when finished, so the library scan never sees half-written files.
 */
@CapacitorPlugin(name = "NianYoutube")
class NianYoutubePlugin : Plugin() {
    private val downloads = Executors.newSingleThreadExecutor()
    private val work = Executors.newCachedThreadPool()
    private val initDone = CountDownLatch(1)
    @Volatile private var initError: String? = null
    private val cancelled = Collections.synchronizedSet(mutableSetOf<String>())

    override fun load() {
        Thread {
            try {
                YoutubeDL.getInstance().init(context)
                FFmpeg.getInstance().init(context)
            } catch (e: Throwable) {
                initError = e.message ?: e.toString()
            } finally {
                initDone.countDown()
            }
        }.start()
    }

    /** null when yt-dlp is ready, otherwise the reason it isn't */
    private fun awaitInit(): String? {
        initDone.await()
        return initError
    }

    private fun version(): String? = try { YoutubeDL.getInstance().version(context) } catch (e: Throwable) { null }

    @PluginMethod
    fun status(call: PluginCall) {
        work.execute {
            val err = awaitInit()
            call.resolve(JSObject()
                .put("ready", err == null)
                .put("version", if (err == null) version() else null)
                .put("error", err))
        }
    }

    @PluginMethod
    fun update(call: PluginCall) {
        work.execute {
            val err = awaitInit()
            if (err != null) { call.reject(err); return@execute }
            try {
                val status = YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel.STABLE)
                call.resolve(JSObject().put("status", status?.name ?: "").put("version", version()))
            } catch (e: Throwable) {
                call.reject(e.message ?: "Falha ao atualizar o yt-dlp")
            }
        }
    }

    @PluginMethod
    fun search(call: PluginCall) {
        val query = call.getString("query")?.trim().orEmpty()
        val limit = (call.getInt("limit") ?: 20).coerceIn(1, 50)
        if (query.isEmpty()) { call.resolve(JSObject().put("out", "")); return }
        work.execute {
            val err = awaitInit()
            if (err != null) { call.reject(err); return@execute }
            try {
                val request = YoutubeDLRequest("ytsearch$limit:$query")
                request.addOption("--dump-json")
                request.addOption("--flat-playlist")
                request.addOption("--no-download")
                request.addOption("--no-warnings")
                val response = YoutubeDL.getInstance().execute(request)
                call.resolve(JSObject().put("out", response.out))
            } catch (e: Throwable) {
                call.reject(lastLine(e.message) ?: "Falha na busca")
            }
        }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        val id = call.getString("id")
        if (id != null) {
            cancelled.add(id)
            try { YoutubeDL.getInstance().destroyProcessById(id) } catch (_: Throwable) {}
        }
        call.resolve()
    }

    @PluginMethod
    fun download(call: PluginCall) {
        val id = call.getString("id")
        val url = call.getString("url")
        if (id.isNullOrEmpty() || url.isNullOrEmpty()) { call.reject("id e url são obrigatórios"); return }
        val playlist = call.getBoolean("playlist", false) ?: false
        call.resolve()
        downloads.execute { runDownload(id, url, playlist) }
    }

    private fun runDownload(id: String, url: String, playlist: Boolean) {
        if (cancelled.remove(id)) { done(id, ok = false, cancelled = true, error = null); return }
        val err = awaitInit()
        if (err != null) { done(id, ok = false, cancelled = false, error = err); return }

        val stage = File(context.cacheDir, "ytdl/$id").apply { mkdirs() }
        val target = File(context.getExternalFilesDir(null) ?: context.filesDir, "YouTube").apply { mkdirs() }
        val reported = Collections.synchronizedSet(mutableSetOf<String>())
        var lastProgressAt = 0L

        // Keep the CPU awake while downloading (the screen may turn off)
        val wake = (context.getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NianPlay:download")
        wake.acquire(60 * 60 * 1000L)

        fun handleFileLine(line: String) {
            // MARK_FILE \t webpage_url \t final file path
            val parts = line.split('\t')
            if (parts.size < 3) return
            val source = File(parts[2].trim())
            if (!reported.add(source.absolutePath) || !source.exists()) return
            val dest = uniqueFile(target, source.name)
            try {
                source.copyTo(dest, overwrite = false)
                source.delete()
                notifyListeners("file", JSObject().put("id", id).put("url", parts[1].trim()).put("path", dest.absolutePath))
            } catch (e: Throwable) {
                notifyListeners("progress", JSObject().put("id", id).put("warning", e.message ?: "falha ao mover o arquivo"))
            }
        }

        try {
            val request = YoutubeDLRequest(url)
            request.addOption("-f", "bestaudio/best")
            request.addOption("--extract-audio")
            request.addOption("--audio-format", "mp3")
            request.addOption("--audio-quality", "0")
            request.addOption("--embed-thumbnail")
            request.addOption("--convert-thumbnails", "jpg")
            request.addOption("--embed-metadata")
            request.addOption("-o", File(stage, "%(title,id)s.%(ext)s").absolutePath)
            request.addOption("--windows-filenames")
            request.addOption("--newline")
            request.addOption("--progress")
            request.addOption("--no-warnings")
            request.addOption(if (playlist) "--yes-playlist" else "--no-playlist")
            if (playlist) request.addOption("--ignore-errors")
            request.addOption("--print", "before_dl:$MARK_TITLE\t%(title)s")
            request.addOption("--print", "after_move:$MARK_FILE\t%(webpage_url)s\t%(filepath)s")
            request.addOption("--no-simulate")

            val response = YoutubeDL.getInstance().execute(request, id) { progress: Float, eta: Long, line: String ->
                when {
                    line.startsWith("$MARK_FILE\t") -> handleFileLine(line)
                    line.startsWith("$MARK_TITLE\t") -> notifyListeners("progress", JSObject()
                        .put("id", id).put("percent", 0).put("title", line.substring(MARK_TITLE.length + 1)))
                    else -> {
                        val now = System.currentTimeMillis()
                        if (progress >= 0 && now - lastProgressAt > 300) {
                            lastProgressAt = now
                            notifyListeners("progress", JSObject().put("id", id).put("percent", progress.toDouble()).put("eta", eta))
                        }
                    }
                }
            }
            // Lines the callback may not have seen
            response.out.lines().filter { it.startsWith("$MARK_FILE\t") }.forEach { handleFileLine(it) }
            done(id, ok = reported.isNotEmpty() || response.exitCode == 0, cancelled = false, error = null)
        } catch (e: YoutubeDL.CanceledException) {
            done(id, ok = false, cancelled = true, error = null)
        } catch (e: Throwable) {
            if (cancelled.remove(id)) done(id, ok = false, cancelled = true, error = null)
            else done(id, ok = reported.isNotEmpty(), cancelled = false, error = lastLine(e.message) ?: "Falha no download")
        } finally {
            if (wake.isHeld) wake.release()
            stage.deleteRecursively()
        }
    }

    private fun done(id: String, ok: Boolean, cancelled: Boolean, error: String?) {
        notifyListeners("done", JSObject().put("id", id).put("ok", ok).put("cancelled", cancelled).put("error", error))
    }

    private fun uniqueFile(dir: File, name: String): File {
        var f = File(dir, name)
        if (!f.exists()) return f
        val dot = name.lastIndexOf('.')
        val stem = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var n = 2
        while (f.exists()) f = File(dir, "$stem ($n)$ext").also { n++ }
        return f
    }

    // yt-dlp errors end with the useful line ("ERROR: [youtube] …: Video unavailable")
    private fun lastLine(msg: String?): String? =
        msg?.lines()?.map { it.trim() }?.lastOrNull { it.isNotEmpty() }?.removePrefix("ERROR: ")

    companion object {
        private const val MARK_FILE = "NIANPLAY_FILE"
        private const val MARK_TITLE = "NIANPLAY_TITLE"
    }
}
