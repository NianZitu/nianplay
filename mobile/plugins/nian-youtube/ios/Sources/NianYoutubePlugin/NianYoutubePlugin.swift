import Foundation
import AVFoundation
import Capacitor
import YouTubeKit

// YouTube on the iPhone — same JS API and events as the Android plugin (NianYoutubePlugin.kt), so
// mobile/src/platform/youtube.js serves both. iOS can't run yt-dlp (apps may not start other
// programs), so this uses YouTubeKit: it finds the audio stream on the device and the file is
// downloaded directly.
//
//   status()  → { ready, version }      update() → { status, version }  (YouTubeKit updates come with the app)
//   search({ query, limit })  → { out }  (one JSON object per line, same fields as yt-dlp's --dump-json)
//   download({ id, url, playlist, title?, artist? })  → resolves at once; events:
//        "progress" { id, percent, eta, title? }
//        "file"     { id, url, path, title, artist, cover }   (m4a in Documents/YouTube; cover = jpg path)
//        "done"     { id, ok, cancelled, error }
//   cancel({ id })
//
// Audio: the AAC (m4a) stream with the highest bitrate, downloaded in 9 MB ranges (YouTube throttles
// single big requests), then rewritten as a regular .m4a with title/artist/cover tags.

private struct Job {
    let id: String
    let url: String
    let title: String
    let artist: String
}

private enum NianError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let m) = self { return m }; return nil }
}

@objc(NianYoutubePlugin)
public class NianYoutubePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NianYoutubePlugin"
    public let jsName = "NianYoutube"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "search", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private static let version = "YouTubeKit 0.4.8"
    private let lock = NSLock()
    private var queue: [Job] = []
    private var running = false
    private var cancelled = Set<String>()
    private var currentTask: Task<Void, Never>?
    private var currentId: String?

    // MARK: - JS API

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["ready": true, "version": NianYoutubePlugin.version])
    }

    @objc func update(_ call: CAPPluginCall) {
        call.resolve(["status": "ALREADY_UP_TO_DATE", "version": NianYoutubePlugin.version])
    }

    @objc func search(_ call: CAPPluginCall) {
        let query = (call.getString("query") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let limit = max(1, min(50, call.getInt("limit") ?? 20))
        if query.isEmpty { call.resolve(["out": ""]); return }
        Task {
            do {
                let out = try await NianYoutubePlugin.searchYoutube(query, limit: limit)
                call.resolve(["out": out])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        if let id = call.getString("id") {
            lock.lock()
            cancelled.insert(id)
            let task = currentId == id ? currentTask : nil
            lock.unlock()
            task?.cancel()
        }
        call.resolve()
    }

    @objc func download(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty, let url = call.getString("url"), !url.isEmpty else {
            call.reject("id e url são obrigatórios"); return
        }
        if call.getBool("playlist") ?? false {
            call.reject("No iPhone dá para baixar só uma música por vez (playlists do YouTube ainda não).")
            return
        }
        call.resolve()
        lock.lock()
        queue.append(Job(id: id, url: url, title: call.getString("title") ?? "", artist: call.getString("artist") ?? ""))
        let start = !running
        running = true
        lock.unlock()
        if start { runNext() }
    }

    // MARK: - queue (one download at a time)

    private func runNext() {
        lock.lock()
        guard !queue.isEmpty else { running = false; currentId = nil; currentTask = nil; lock.unlock(); return }
        let job = queue.removeFirst()
        let skip = cancelled.remove(job.id) != nil
        currentId = job.id
        lock.unlock()

        if skip {
            emit("done", ["id": job.id, "ok": false, "cancelled": true])
            runNext()
            return
        }
        let task = Task { [weak self] in
            guard let self = self else { return }
            await self.run(job)
            self.runNext()
        }
        lock.lock(); currentTask = task; lock.unlock()
    }

    private func emit(_ event: String, _ data: [String: Any]) {
        DispatchQueue.main.async { self.notifyListeners(event, data: data) }
    }

    // (In the background iOS suspends the app unless music is playing — the audio background mode
    // keeps it running then, and the download goes on.)
    private func run(_ job: Job) async {
        do {
            guard let videoID = NianYoutubePlugin.videoID(from: job.url) else {
                throw NianError.message("Link do YouTube inválido")
            }
            let link = "https://www.youtube.com/watch?v=\(videoID)"

            // Title / artist: what the app already knows (search result, playlist track), else oEmbed
            var title = job.title
            var artist = job.artist
            if title.isEmpty || artist.isEmpty, let info = try? await NianYoutubePlugin.oembed(videoID) {
                if title.isEmpty { title = info.title }
                if artist.isEmpty { artist = info.author }
            }
            artist = artist.replacingOccurrences(of: #"\s+-\s+Topic$"#, with: "", options: .regularExpression)
            emit("progress", ["id": job.id, "percent": 0, "title": title.isEmpty ? videoID : title])

            let video = YouTube(videoID: videoID, methods: [.local])
            let streams = try await video.streams
            let audio = streams.filterAudioOnly()
            let candidates = audio.filter { $0.fileExtension == .m4a && $0.isNativelyPlayable }
            guard let stream = candidates.max(by: { ($0.bitrate ?? 0) < ($1.bitrate ?? 0) }) else {
                throw NianError.message("Não encontramos um áudio compatível neste vídeo")
            }

            let fm = FileManager.default
            let docs = try fm.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let folder = docs.appendingPathComponent("YouTube", isDirectory: true)
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            let tmp = fm.temporaryDirectory.appendingPathComponent("\(job.id).part.m4a")
            try? fm.removeItem(at: tmp)

            try await downloadRanges(stream.url, to: tmp, jobId: job.id)
            try Task.checkCancellation()

            let artwork = await NianYoutubePlugin.thumbnail(videoID)
            let name = NianYoutubePlugin.safeName(title.isEmpty ? videoID : title)
            // Tagged copy made in the temp folder too: the library scan must never see a half-written file
            let tagged = fm.temporaryDirectory.appendingPathComponent("\(job.id).m4a")
            try? fm.removeItem(at: tagged)
            let ready = await NianYoutubePlugin.tag(tmp, to: tagged, title: title, artist: artist, artwork: artwork) ? tagged : tmp
            let dest = NianYoutubePlugin.unique(folder.appendingPathComponent("\(name).m4a"))
            try fm.moveItem(at: ready, to: dest)   // the untagged audio if tagging failed
            try? fm.removeItem(at: tmp)
            try? fm.removeItem(at: tagged)

            var cover = ""
            if let artwork = artwork {
                let coverURL = folder.appendingPathComponent(".cover-\(job.id).jpg")
                if (try? artwork.write(to: coverURL)) != nil { cover = coverURL.path }
            }
            emit("file", ["id": job.id, "url": link, "path": dest.path, "title": title, "artist": artist, "cover": cover])
            emit("done", ["id": job.id, "ok": true, "cancelled": false])
        } catch is CancellationError {
            emit("done", ["id": job.id, "ok": false, "cancelled": true])
        } catch {
            lock.lock(); let wasCancelled = cancelled.remove(job.id) != nil; lock.unlock()
            if wasCancelled || (error as? URLError)?.code == .cancelled {
                emit("done", ["id": job.id, "ok": false, "cancelled": true])
            } else {
                emit("done", ["id": job.id, "ok": false, "cancelled": false, "error": error.localizedDescription])
            }
        }
    }

    // MARK: - download

    private func downloadRanges(_ url: URL, to file: URL, jobId: String) async throws {
        let chunk = 9 * 1024 * 1024
        FileManager.default.createFile(atPath: file.path, contents: nil)
        let handle = try FileHandle(forWritingTo: file)
        defer { try? handle.close() }

        // Size from the stream URL (clen=…), else from the first response
        var total = Int(URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "clen" })?.value ?? "") ?? 0
        var offset = 0
        let started = Date()
        var lastEmit = Date.distantPast

        while total == 0 || offset < total {
            try Task.checkCancellation()
            var request = URLRequest(url: url)
            request.setValue("bytes=\(offset)-\(offset + chunk - 1)", forHTTPHeaderField: "Range")
            request.timeoutInterval = 60
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                throw NianError.message("O YouTube recusou o download (HTTP \(code)). Tente de novo mais tarde.")
            }
            if total == 0 {
                if let range = http.value(forHTTPHeaderField: "Content-Range"), let slash = range.lastIndex(of: "/") {
                    total = Int(range[range.index(after: slash)...]) ?? 0
                }
                if total == 0 { total = offset + data.count }   // server sent everything at once
            }
            if data.isEmpty { break }
            try handle.write(contentsOf: data)
            offset += data.count

            if Date().timeIntervalSince(lastEmit) > 0.3 || offset >= total {
                lastEmit = Date()
                let percent = total > 0 ? Double(offset) / Double(total) * 100 : 0
                let elapsed = Date().timeIntervalSince(started)
                let eta = offset > 0 && total > offset ? Int(elapsed / Double(offset) * Double(total - offset)) : 0
                emit("progress", ["id": jobId, "percent": percent, "eta": eta])
            }
            if http.statusCode == 200 { break }   // Range ignored: the whole file came in one response
        }
    }

    // Rewrites the downloaded (fragmented) MP4 audio as a normal .m4a with tags, without re-encoding
    private static func tag(_ source: URL, to dest: URL, title: String, artist: String, artwork: Data?) async -> Bool {
        let asset = AVURLAsset(url: source)
        guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else { return false }
        export.outputURL = dest
        export.outputFileType = .m4a
        var items: [AVMetadataItem] = []
        func item(_ id: AVMetadataIdentifier, _ value: NSCopying & NSObjectProtocol, _ type: String? = nil) {
            let m = AVMutableMetadataItem()
            m.identifier = id
            m.value = value
            if let type = type { m.dataType = type }
            m.extendedLanguageTag = "und"
            items.append(m)
        }
        if !title.isEmpty { item(.commonIdentifierTitle, title as NSString) }
        if !artist.isEmpty { item(.commonIdentifierArtist, artist as NSString) }
        if let artwork = artwork { item(.commonIdentifierArtwork, artwork as NSData, kCMMetadataBaseDataType_JPEG as String) }
        export.metadata = items
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            export.exportAsynchronously { done.resume() }
        }
        return export.status == .completed
    }

    // MARK: - YouTube helpers

    private static func videoID(from url: String) -> String? {
        let patterns = [
            #"(?:youtube\.com/watch\?(?:[^#]*&)?v=)([A-Za-z0-9_-]{11})"#,
            #"(?:youtu\.be/)([A-Za-z0-9_-]{11})"#,
            #"(?:youtube\.com/(?:shorts|embed|live|v)/)([A-Za-z0-9_-]{11})"#
        ]
        for p in patterns {
            if let re = try? NSRegularExpression(pattern: p, options: [.caseInsensitive]),
               let m = re.firstMatch(in: url, range: NSRange(url.startIndex..., in: url)),
               let r = Range(m.range(at: 1), in: url) {
                return String(url[r])
            }
        }
        return nil
    }

    private static func oembed(_ id: String) async throws -> (title: String, author: String) {
        var c = URLComponents(string: "https://www.youtube.com/oembed")!
        c.queryItems = [URLQueryItem(name: "url", value: "https://www.youtube.com/watch?v=\(id)"), URLQueryItem(name: "format", value: "json")]
        let (data, _) = try await URLSession.shared.data(from: c.url!)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        return (json["title"] as? String ?? "", json["author_name"] as? String ?? "")
    }

    // Biggest thumbnail available, as JPEG
    private static func thumbnail(_ id: String) async -> Data? {
        for name in ["maxresdefault", "sddefault", "hqdefault"] {
            guard let url = URL(string: "https://i.ytimg.com/vi/\(id)/\(name).jpg"),
                  let result = try? await URLSession.shared.data(from: url),
                  (result.1 as? HTTPURLResponse)?.statusCode == 200, result.0.count > 2000 else { continue }
            return result.0
        }
        return nil
    }

    private static func safeName(_ s: String) -> String {
        let bad = CharacterSet(charactersIn: "/\\:*?\"<>|\n\r\t")
        let cleaned = s.components(separatedBy: bad).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let short = String(cleaned.prefix(120))
        return short.isEmpty || short.hasPrefix(".") ? "musica" : short
    }

    private static func unique(_ url: URL) -> URL {
        let fm = FileManager.default
        if !fm.fileExists(atPath: url.path) { return url }
        let stem = url.deletingPathExtension().lastPathComponent
        let ext = url.pathExtension
        let dir = url.deletingLastPathComponent()
        var n = 2
        while true {
            let candidate = dir.appendingPathComponent("\(stem) (\(n)).\(ext)")
            if !fm.fileExists(atPath: candidate.path) { return candidate }
            n += 1
        }
    }

    // YouTube's own search (the endpoint youtube.com uses), videos only. Output: one JSON object per
    // line with id/title/duration/channel — the same fields youtube.js reads from yt-dlp on Android.
    private static func searchYoutube(_ query: String, limit: Int) async throws -> String {
        var request = URLRequest(url: URL(string: "https://www.youtube.com/youtubei/v1/search?prettyPrint=false")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "context": ["client": ["clientName": "WEB", "clientVersion": "2.20251110.00.00", "hl": "pt", "gl": "BR"]],
            "query": query,
            "params": "EgIQAQ=="   // filter: videos
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NianError.message("A busca no YouTube falhou") }
        let root = try JSONSerialization.jsonObject(with: data)

        var results: [[String: Any]] = []
        func walk(_ node: Any) {
            if results.count >= limit { return }
            if let dict = node as? [String: Any] {
                if let v = dict["videoRenderer"] as? [String: Any], let id = v["videoId"] as? String {
                    let title = ((v["title"] as? [String: Any])?["runs"] as? [[String: Any]])?.compactMap { $0["text"] as? String }.joined() ?? ""
                    let channel = (((v["ownerText"] as? [String: Any])?["runs"] as? [[String: Any]])?.first?["text"] as? String) ?? ""
                    let length = (v["lengthText"] as? [String: Any])?["simpleText"] as? String ?? ""
                    results.append(["id": id, "title": title, "channel": channel, "duration": seconds(length),
                                    "url": "https://www.youtube.com/watch?v=\(id)"])
                    return
                }
                for value in dict.values { walk(value) }
            } else if let array = node as? [Any] {
                for value in array { walk(value) }
            }
        }
        walk(root)
        return results.compactMap { r -> String? in
            guard let d = try? JSONSerialization.data(withJSONObject: r) else { return nil }
            return String(data: d, encoding: .utf8)
        }.joined(separator: "\n")
    }

    private static func seconds(_ text: String) -> Int {
        text.split(separator: ":").reduce(0) { $0 * 60 + (Int($1) ?? 0) }
    }
}
