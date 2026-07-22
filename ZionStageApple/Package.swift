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
    dependencies: [
        .package(
            url: "https://github.com/firebase/firebase-ios-sdk.git",
            from: "10.29.0"
        )
    ],
    targets: [
        .executableTarget(
            name: "ZionStageApple",
            dependencies: [
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
            ],
            path: "Shared",
            exclude: ["GoogleService-Info.plist"]
        )
    ]
)
