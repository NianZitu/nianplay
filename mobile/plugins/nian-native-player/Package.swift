// swift-tools-version: 5.9
// Package/product name must be "NianNativePlayer": Capacitor derives it from the npm name
// "nian-native-player" (fixName) when it writes CapApp-SPM/Package.swift.
import PackageDescription

let package = Package(
    name: "NianNativePlayer",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "NianNativePlayer", targets: ["NianNativePlayerPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "NianNativePlayerPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/NianNativePlayerPlugin")
    ]
)
