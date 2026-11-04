import Foundation

actor UploadProbe {
    private var pending: CheckedContinuation<Void, Never>?
    private var observer: CheckedContinuation<Void, Never>?
    private(set) var calls = 0
    private(set) var latitudes: [Double] = []

    func upload(_ update: NativeLocationBatchUpdate) async throws {
        calls += 1
        latitudes.append(update.latitude)
        await withCheckedContinuation { continuation in
            pending = continuation
            observer?.resume(); observer = nil
        }
    }
    func waitForUpload() async {
        if pending != nil { return }
        await withCheckedContinuation { observer = $0 }
    }
    func release() { pending?.resume(); pending = nil }
}
