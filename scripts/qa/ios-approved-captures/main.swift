import Foundation

struct CaptureManifest: Encodable {
    let sourceHead: String
    let testedCommit: String
    let runId: String
    let fixtureOutcome: String
    let fixtureOnly = true
    let physicalDevice = false
    let retentionDays = 1
    let approvedMaximumBytes = 2_000_000
    let images: [ApprovedImage]
}

func command(_ path: String, _ arguments: [String]) throws -> Data {
    let process = Process(); let pipe = Pipe()
    process.executableURL = URL(fileURLWithPath: path); process.arguments = arguments
    process.standardOutput = pipe
    try process.run()
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { throw ApprovedCaptureFailure.invalidRun }
    return data
}

func exportApprovedImages() throws {
    let env = ProcessInfo.processInfo.environment
    guard let phone = env["PHONE_ID"], UUID(uuidString: phone) != nil,
          let root = env["RUNNER_TEMP"], root.hasPrefix("/"),
          let head = env["SOURCE_HEAD"], head.count == 40, head.allSatisfy({ "0123456789abcdef".contains($0) }),
          let run = env["GITHUB_RUN_ID"], !run.isEmpty, run.allSatisfy(\.isNumber),
          let outcome = env["FIXTURE_OUTCOME"], ["success", "failure"].contains(outcome) else {
        throw ApprovedCaptureFailure.invalidRun
    }
    let runner = "be.sportgreenmoove.app.uitests.xctrunner"
    let apps = try PropertyListSerialization.propertyList(from: command("/usr/bin/xcrun", ["simctl", "listapps", phone]), format: nil)
    guard let installed = apps as? [String: Any], installed[runner] != nil else { throw ApprovedCaptureFailure.invalidRun }
    let container = String(decoding: try command("/usr/bin/xcrun", ["simctl", "get_app_container", phone, runner, "data"]), as: UTF8.self)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    guard container.hasPrefix("/") else { throw ApprovedCaptureFailure.invalidDirectory }
    let source = URL(fileURLWithPath: container, isDirectory: true).appendingPathComponent("Documents/SGMApprovedCaptures", isDirectory: true)
    let images = try validateApprovedImages(source)
    let destination = URL(fileURLWithPath: root, isDirectory: true).appendingPathComponent("sgm-approved-iphone-captures", isDirectory: true)
    let files = FileManager.default
    guard !files.fileExists(atPath: destination.path) else { throw ApprovedCaptureFailure.invalidDirectory }
    try files.createDirectory(at: destination, withIntermediateDirectories: false)
    for image in images { try files.copyItem(at: source.appendingPathComponent(image.file), to: destination.appendingPathComponent(image.file)) }
    guard try validateApprovedImages(destination) == images else { throw ApprovedCaptureFailure.invalidImage }
    let commit = String(decoding: try command("/usr/bin/git", ["rev-parse", "HEAD"]), as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
    guard commit.count == 40, commit.allSatisfy({ "0123456789abcdef".contains($0) }) else { throw ApprovedCaptureFailure.invalidRun }
    let manifest = CaptureManifest(sourceHead: head, testedCommit: commit, runId: run, fixtureOutcome: outcome, images: images)
    let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(manifest)
    guard images.reduce(0, { $0 + $1.bytes }) + data.count <= 1_990_000 else { throw ApprovedCaptureFailure.overBudget }
    try data.write(to: destination.appendingPathComponent("manifest.json"), options: .atomic)
    print("Validated three unchanged synthetic PNG captures under 2 MB; retention one day; fixture outcome: \(outcome)")
}

if CommandLine.arguments == [CommandLine.arguments[0], "--self-test"] {
    try checkApprovedImagePolicy()
} else {
    guard CommandLine.arguments.count == 1 else { throw ApprovedCaptureFailure.invalidRun }
    try exportApprovedImages()
}
