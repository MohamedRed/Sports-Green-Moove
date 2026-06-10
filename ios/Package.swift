// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "SportsGreenMoove",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .executable(name: "SportsGreenMooveApp", targets: ["SportsGreenMooveApp"])
    ],
    targets: [
        .executableTarget(name: "SportsGreenMooveApp")
    ]
)
