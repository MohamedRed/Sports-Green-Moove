import Foundation
import Observation

@MainActor @Observable final class RideChatComposer {
    private(set) var body = ""
    private(set) var pending: RideChatDraft?
    private(set) var loaded = false
    private(set) var error: String?
    private let uid: RideChatID
    private let reference: RideChatReference
    private let makeStorage: @Sendable () throws -> any RideChatDraftStorage
    private var storage: (any RideChatDraftStorage)?
    init(uid: RideChatID, reference: RideChatReference, makeStorage: @escaping @Sendable () throws -> any RideChatDraftStorage) {
        self.uid = uid; self.reference = reference; self.makeStorage = makeStorage
    }
    func clear() { body = ""; pending = nil; loaded = false; error = nil }
    func load() {
        guard !loaded else { return }
        do {
            let saved = try store().read(uid: uid, reference: reference)
            if let saved {
                try RideChatWire.require(saved.uid == uid && saved.reference == reference && saved.body.utf16.count <= 16_384 &&
                    (saved.requestId == nil || RideChatText.valid(saved.body)))
            }
            body = saved?.body ?? ""; pending = saved?.requestId == nil ? nil : saved; loaded = true
            error = pending == nil ? nil : "Envoi non confirmé. Réessayez avec le même message."
        } catch { self.error = "Impossible de restaurer votre brouillon. Réessayez." }
    }
    func edit(_ value: String) {
        guard loaded, pending == nil else { return }
        guard value.utf16.count <= 16_384 else { error = "Le brouillon est trop long."; return }
        do { try store().write(.init(uid: uid, reference: reference, body: value, requestId: nil)); body = value; error = nil }
        catch { self.error = "Impossible de conserver le brouillon. Réessayez." }
    }
    func prepare() -> (draft: RideChatDraft, retrying: Bool)? {
        guard loaded, RideChatText.valid(body) else { error = "Le message doit contenir au maximum 1 000 caractères."; return nil }
        let retrying = pending != nil, next = pending ?? .init(uid: uid, reference: reference, body: body, requestId: UUID())
        do { try store().write(next); pending = next; error = nil; return (next, retrying) }
        catch { self.error = "Impossible de conserver le message. Aucun nouvel envoi n’a été lancé."; return nil }
    }
    func acknowledge(_ expected: RideChatDraft) {
        guard pending == expected else { return }
        do { try store().remove(expected); body = ""; pending = nil; error = nil }
        catch { self.error = "Message confirmé, mais le brouillon n’a pas pu être effacé. Réessayez." }
    }
    func reconcile(_ rows: [RideChatMessage]) throws {
        guard let pending, let request = pending.requestId else { return }
        let id = try RideChatID(TeamChatIdentity.operation(uid: uid.value, requestId: request))
        guard rows.contains(where: { $0.id == id && $0.sender == uid && $0.requestId == request &&
                  RideChatText.same($0.body, RideChatText.normalized(pending.body)) }) else { return }
        acknowledge(pending)
    }
    func failed(_ expected: RideChatDraft, rejected: Bool, retrying: Bool) {
        guard pending == expected else { return }
        if rejected && !retrying {
            do { try store().releaseRejected(expected); pending = nil; error = "Envoi refusé. Vérifiez le message et actualisez." }
            catch { self.error = "Envoi refusé, mais le brouillon reste verrouillé. Réessayez." }
        } else { error = "Envoi non confirmé. Réessayez avec le même message." }
    }
    private func store() throws -> any RideChatDraftStorage {
        if let storage { return storage }; let next = try makeStorage(); storage = next; return next
    }
}
