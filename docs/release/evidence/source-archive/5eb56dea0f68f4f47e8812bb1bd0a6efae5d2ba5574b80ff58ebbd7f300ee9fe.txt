import Foundation

#if DEBUG
import OSLog

enum UITestBootDiagnostics {
    private static let logger = Logger(subsystem: "be.sportgreenmoove.fixture.boot", category: "startup")
    static func record(_ phase: String) { logger.notice("phase=\(phase, privacy: .public)") }
}
#endif
