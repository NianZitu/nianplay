// swift-tools-version: 5.9
// Package/product name must be "NianYoutube": Capacitor derives it from the npm name "nian-youtube"
// (fixName) when it writes CapApp-SPM/Package.swift.
import PackageDescription

let package = Package(
    name: "NianYoutube",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "NianYoutube", targets: ["NianYoutubePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        // Finds the audio stream of a video on the device (JavaScriptCore deciphering), no yt-dlp needed
        .package(url: "https://github.com/alexeichhorn/YouTubeKit.git", from: "0.4.8")
    ],
    targets: [
        .target(
            name: "NianYoutubePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "YouTubeKit", package: "YouTubeKit")
            ],
            path: "ios/Sources/NianYoutubePlugin")
    ]
)
