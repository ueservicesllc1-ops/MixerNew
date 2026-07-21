// swift-tools-version: 5.7
import PackageDescription

let package = Package(
    name: "ZionStageApple",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .executable(
            name: "ZionStageApple",
            targets: ["ZionStageApple"]
        )
    ],
    targets: [
        .executableTarget(
            name: "ZionStageApple",
            path: "Shared",
            exclude: ["GoogleService-Info.plist"]
        )
    ]
)
