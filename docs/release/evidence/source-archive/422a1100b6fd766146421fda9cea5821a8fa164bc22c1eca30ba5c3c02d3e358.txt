import XCTest

enum ApprovedCapture: String, CaseIterable {
    case home = "home.png"
    case profile = "profile.png"
    case rating = "rating-sent.png"
}

private enum CaptureFailure: Error { case notFixture, unexpectedScreen, duplicate, overBudget, invalidFile }

@MainActor
func captureApproved(_ capture: ApprovedCapture, in app: XCUIApplication) {
    guard Bundle(for: SportsGreenMooveUITests.self).object(forInfoDictionaryKey: "SGMApprovedCaptures") as? String == "YES" else { return }
    do {
        guard app.launchArguments.contains("--sgm-ui-test-fixture"), app.state == .runningForeground else {
            throw CaptureFailure.notFixture
        }
        switch capture {
        case .home:
            guard app.descendants(matching: .any)["home.screen"].exists else { throw CaptureFailure.unexpectedScreen }
        case .profile:
            guard app.staticTexts["profile.name"].label == "Parent D\u{00e9}mo",
                  app.buttons["profile.role.parent"].exists, app.buttons["profile.role.driver"].exists,
                  !app.buttons["profile.role.child"].exists, !app.buttons["profile.role.clubManager"].exists else {
                throw CaptureFailure.unexpectedScreen
            }
        case .rating:
            guard app.staticTexts["Avis envoy\u{00e9}."].exists,
                  !app.descendants(matching: .any)["messages.rating-prompt.action"].exists else {
                throw CaptureFailure.unexpectedScreen
            }
        }
        let files = FileManager.default
        guard let documents = files.urls(for: .documentDirectory, in: .userDomainMask).first else { throw CaptureFailure.invalidFile }
        let folder = documents.appendingPathComponent("SGMApprovedCaptures", isDirectory: true)
        try files.createDirectory(at: folder, withIntermediateDirectories: true)
        let previous = try files.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])
        guard previous.count < 3, previous.allSatisfy({ ApprovedCapture(rawValue: $0.lastPathComponent) != nil }),
              !files.fileExists(atPath: folder.appendingPathComponent(capture.rawValue).path) else {
            throw CaptureFailure.duplicate
        }
        let bytes = app.screenshot().pngRepresentation
        let used = try previous.reduce(0) { total, url in
            let info = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
            guard let size = info.fileSize, info.isRegularFile == true, info.isSymbolicLink != true else { throw CaptureFailure.invalidFile }
            return total + size
        }
        guard !bytes.isEmpty, used + bytes.count <= 1_900_000 else { throw CaptureFailure.overBudget }
        try bytes.write(to: folder.appendingPathComponent(capture.rawValue), options: .atomic)
    } catch {
        XCTFail("Approved synthetic capture failed: \(error)")
    }
}
