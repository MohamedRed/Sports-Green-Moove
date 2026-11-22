import Foundation
import Observation

@Observable @MainActor final class SupportSubmissionState {
    private(set) var reason = "Sécurité"
    private(set) var description = ""
    private(set) var emergency = false
    private(set) var pending: SupportSubmission?
    private(set) var busy = false
    private(set) var ready = false
    private(set) var message: String?
    private var closed = false
    private let uid: String
    private let submitter: (SupportSubmission) async throws -> String
    private let makeStore: () throws -> SupportSubmissionStore
    private var store: SupportSubmissionStore?
    var editable: Bool { ready && !busy && pending == nil && !closed }
    init(uid: String, submitter: @escaping (SupportSubmission) async throws -> String,
         makeStore: @escaping () throws -> SupportSubmissionStore = SupportSubmissionStore.platformStore) {
        self.uid = uid; self.submitter = submitter; self.makeStore = makeStore; restore()
    }
    func setReason(_ value: String) { if editable { reason = value } }
    func setDescription(_ value: String) { if editable { description = value } }
    func setEmergency(_ value: Bool) { if editable { emergency = value } }
    func restore() {
        guard !closed, !busy else { return }; ready = false
        do {
            let storage = try makeStore(); store = storage; pending = try storage.read(uid: uid)
            restoreFields(); ready = true
            message = pending == nil ? nil : "Envoi non confirmé. Réessayez pour vérifier cette demande."
        } catch { message = "Impossible de retrouver l’envoi en attente. Réessayez." }
    }
    func submit() async {
        guard !closed, !busy, ready, let store else { return }
        let operation = pending ?? SupportSubmission(uid: uid, requestId: UUID().uuidString.lowercased(),
            reason: reason.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines), emergency: emergency)
        guard operation.isValid else { message = "Ajoutez une raison et une description précise."; return }
        busy = true; message = nil
        defer { if !closed { busy = false } }
        do {
            pending = try store.begin(operation)
            let id = try await submitter(operation)
            try Task.checkCancellation(); guard !closed else { return }
            guard !id.isEmpty else { throw SupportSubmissionError.receipt }
            try store.acknowledge(uid: uid, requestId: operation.requestId)
            pending = nil; description = ""; emergency = false; message = "Signalement envoyé: \(id)"
        } catch is CancellationError { }
        catch {
            guard !closed else { return }
            do { pending = try store.read(uid: uid); restoreFields(); ready = true }
            catch { ready = false }
            message = pending == nil ? "Envoi non confirmé. Réessayez avant de quitter cet écran." :
                "Envoi non confirmé. Réessayez pour vérifier cette demande."
        }
    }
    private func restoreFields() {
        if let pending { reason = pending.reason; description = pending.description; emergency = pending.emergency }
    }
    func close() { closed = true; ready = false; pending = nil; reason = "Sécurité"; description = ""; emergency = false; message = nil }
}
