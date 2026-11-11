import Foundation
import AVFoundation
import MediaPlayer
import UIKit
import Capacitor

// NianPlay native player (iOS).
//
// Why native: in the WebView, the music went through Web Audio (needed for the per-track LUFS gain),
// and iOS stops Web Audio when the app leaves the screen — the song kept "running" silently. Here an
// AVPlayer plays the files, so it keeps playing in the background with the screen off.
//
// Why the queue lives here too: in the background iOS suspends the WebView's JavaScript, so the
// app's player (PlayerContext) can't start the next song. JS sends the upcoming songs (setUpcoming);
// when a song ends — or next/previous is pressed on the lock screen — this plugin moves on by itself
// and tells JS ("advanced"), which catches up when it runs again.
//
// Items: { url (file:// URL, also the item's identity), title, artist, album, artwork (file:// URL),
//          volume (0…1: LUFS gain × app volume), cuts: [{ start, end }] (seconds to skip) }
// Events: "time" { url, currentTime, duration } (only while the app is on screen), "ready" { url, duration },
//         "state" { playing }, "advanced" { url }, "queueEnded" { url }, "error" { url, message }

private func number(_ value: Any?) -> Double? {
    if let n = value as? NSNumber { return n.doubleValue }
    if let d = value as? Double { return d }
    if let i = value as? Int { return Double(i) }
    return nil
}

private struct NianItem {
    let key: String
    let url: URL
    let title: String
    let artist: String
    let album: String
    let artwork: String?
    var volume: Float
    let cuts: [(start: Double, end: Double)]

    init?(_ data: [String: Any]) {
        guard let key = data["url"] as? String, let url = URL(string: key) else { return nil }
        self.key = key
        self.url = url
        self.title = data["title"] as? String ?? ""
        self.artist = data["artist"] as? String ?? ""
        self.album = data["album"] as? String ?? ""
        self.artwork = data["artwork"] as? String
        self.volume = Float(min(max(number(data["volume"]) ?? 1, 0), 1))
        let rawCuts = data["cuts"] as? [[String: Any]] ?? []
        var parsed: [(start: Double, end: Double)] = []
        for cut in rawCuts {
            if let s = number(cut["start"]), let e = number(cut["end"]), e > s {
                parsed.append((start: s, end: e))
            }
        }
        parsed.sort { $0.start < $1.start }
        self.cuts = parsed
    }
}

@objc(NianNativePlayerPlugin)
public class NianNativePlayerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NianNativePlayerPlugin"
    public let jsName = "NianNativePlayer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setUpcoming", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise)
    ]

    private let player = AVPlayer()
    private var current: NianItem?
    private var upcoming: [NianItem] = []
    private var history: [NianItem] = []
    private var artworkImage: UIImage?
    private var timeObserver: Any?
    private var statusObservation: NSKeyValueObservation?
    private var controlObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var pendingStart: Double = 0
    private var wantsPlay = false
    private var lastPlaying: Bool?

    override public func load() {
        player.automaticallyWaitsToMinimizeStalling = false
        activateSession()

        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.tick(time.seconds)
        }
        controlObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.emitState() }
        }
        NotificationCenter.default.addObserver(self, selector: #selector(onInterruption(_:)),
                                               name: AVAudioSession.interruptionNotification,
                                               object: AVAudioSession.sharedInstance())
        DispatchQueue.main.async { self.setupRemoteCommands() }
    }

    // MARK: - JS API

    @objc func open(_ call: CAPPluginCall) {
        let data = call.options as? [String: Any] ?? [:]
        guard let item = NianItem(data) else {
            call.reject("Invalid audio url")
            return
        }
        let startAt = number(data["startAt"]) ?? 0
        let autoplay = data["autoplay"] as? Bool ?? true
        DispatchQueue.main.async {
            if let previous = self.current, previous.key != item.key {
                self.history.append(previous)
                if self.history.count > 200 { self.history.removeFirst(self.history.count - 200) }
            }
            self.start(item, at: startAt, autoplay: autoplay)
            call.resolve()
        }
    }

    @objc func setUpcoming(_ call: CAPPluginCall) {
        let raw = (call.options as? [String: Any])?["items"] as? [[String: Any]] ?? []
        let items = raw.compactMap { NianItem($0) }
        DispatchQueue.main.async {
            self.upcoming = items
            call.resolve()
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.resume()
            call.resolve()
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.wantsPlay = false
            self.player.pause()
            self.updateNowPlaying()
            call.resolve()
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        let time = call.getDouble("time") ?? 0
        DispatchQueue.main.async {
            self.seek(to: time)
            call.resolve()
        }
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        let volume = Float(min(max(call.getDouble("volume") ?? 1, 0), 1))
        DispatchQueue.main.async {
            self.player.volume = volume
            self.current?.volume = volume
            call.resolve()
        }
    }

    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "url": self.current?.key ?? "",
                "currentTime": self.currentSeconds(),
                "duration": self.durationSeconds() ?? 0,
                "playing": self.player.timeControlStatus != .paused
            ])
        }
    }

    // MARK: - Playback

    private func activateSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [])
        try? session.setActive(true)
    }

    private func start(_ item: NianItem, at startAt: Double, autoplay: Bool) {
        current = item
        artworkImage = nil
        if let art = item.artwork, let artURL = URL(string: art), artURL.isFileURL {
            artworkImage = UIImage(contentsOfFile: artURL.path)
        }

        let avItem = AVPlayerItem(url: item.url)
        statusObservation = avItem.observe(\.status, options: [.new]) { [weak self] observed, _ in
            DispatchQueue.main.async { self?.statusChanged(observed) }
        }
        if let observer = endObserver { NotificationCenter.default.removeObserver(observer) }
        endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime,
                                                             object: avItem, queue: .main) { [weak self] _ in
            self?.advance()
        }

        player.replaceCurrentItem(with: avItem)
        player.volume = item.volume
        pendingStart = startAt
        wantsPlay = autoplay
        if autoplay {
            activateSession()
            player.play()
        }
        updateNowPlaying()
    }

    private func resume() {
        guard player.currentItem != nil else { return }
        activateSession()
        wantsPlay = true
        player.play()
        updateNowPlaying()
    }

    private func seek(to seconds: Double) {
        let target = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            DispatchQueue.main.async { self?.updateNowPlaying() }
        }
    }

    // Song ended, or "next" on the lock screen
    private func advance() {
        if let next = upcoming.first {
            upcoming.removeFirst()
            if let previous = current { history.append(previous) }
            start(next, at: 0, autoplay: true)
            notifyListeners("advanced", data: ["url": next.key])
        } else {
            wantsPlay = false
            player.pause()
            notifyListeners("queueEnded", data: ["url": current?.key ?? ""])
        }
    }

    // "Previous" on the lock screen: restart the song after 3 s, otherwise go back
    private func previous() {
        let firstPlayable = current?.cuts.first(where: { $0.start <= 0.05 })?.end ?? 0
        if currentSeconds() - firstPlayable > 3 || history.isEmpty {
            seek(to: firstPlayable)
            return
        }
        let back = history.removeLast()
        if let now = current { upcoming.insert(now, at: 0) }
        start(back, at: 0, autoplay: true)
        notifyListeners("advanced", data: ["url": back.key])
    }

    private func statusChanged(_ item: AVPlayerItem) {
        guard item === player.currentItem, let now = current else { return }
        switch item.status {
        case .readyToPlay:
            if pendingStart > 0 {
                seek(to: pendingStart)
                pendingStart = 0
            }
            notifyListeners("ready", data: ["url": now.key, "duration": durationSeconds() ?? 0])
            updateNowPlaying()
        case .failed:
            notifyListeners("error", data: ["url": now.key, "message": item.error?.localizedDescription ?? "Falha ao abrir o arquivo"])
            if wantsPlay { advance() }
        default:
            break
        }
    }

    private func tick(_ seconds: Double) {
        guard let now = current, seconds.isFinite else { return }
        // Skip the song's cut segments (also in the background, where JS can't do it)
        if let cut = now.cuts.first(where: { seconds >= $0.start && seconds < $0.end }) {
            let end = durationSeconds() ?? cut.end
            seek(to: min(cut.end + 0.05, end))
            return
        }
        // The WebView is suspended in the background: don't pile up messages for it
        if UIApplication.shared.applicationState == .active {
            notifyListeners("time", data: ["url": now.key, "currentTime": seconds, "duration": durationSeconds() ?? 0])
        }
    }

    private func emitState() {
        let playing = player.timeControlStatus != .paused
        if playing != lastPlaying {
            lastPlaying = playing
            notifyListeners("state", data: ["playing": playing])
        }
        updateNowPlaying()
    }

    private func currentSeconds() -> Double {
        let s = player.currentTime().seconds
        return s.isFinite ? s : 0
    }

    private func durationSeconds() -> Double? {
        guard let d = player.currentItem?.duration.seconds, d.isFinite else { return nil }
        return d
    }

    // MARK: - Lock screen / Control Center

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            self?.resume()
            return .success
        }
        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            self?.wantsPlay = false
            self?.player.pause()
            return .success
        }
        center.togglePlayPauseCommand.isEnabled = true
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self = self else { return .commandFailed }
            if self.player.timeControlStatus == .paused {
                self.resume()
            } else {
                self.wantsPlay = false
                self.player.pause()
            }
            return .success
        }
        center.nextTrackCommand.isEnabled = true
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.advance()
            return .success
        }
        center.previousTrackCommand.isEnabled = true
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.previous()
            return .success
        }
        center.changePlaybackPositionCommand.isEnabled = true
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self = self, let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            self.seek(to: positionEvent.positionTime)
            return .success
        }
        center.skipForwardCommand.isEnabled = false
        center.skipBackwardCommand.isEnabled = false
    }

    private func updateNowPlaying() {
        guard let now = current else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: now.title,
            MPMediaItemPropertyArtist: now.artist,
            MPMediaItemPropertyAlbumTitle: now.album,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentSeconds(),
            MPNowPlayingInfoPropertyPlaybackRate: player.timeControlStatus == .paused ? 0.0 : 1.0
        ]
        if let duration = durationSeconds() { info[MPMediaItemPropertyPlaybackDuration] = duration }
        if let image = artworkImage {
            info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    // Phone calls, alarms, Siri: resume afterwards when the system says so
    @objc private func onInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }
        guard type == .ended else { return }
        let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        if AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) && wantsPlay {
            DispatchQueue.main.async { self.resume() }
        }
    }
}
