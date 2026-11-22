import Foundation
import Observation

@MainActor @Observable final class TeamChatComposer {
    private(set) var body = ""
    private(set) var pending: TeamChatDraft?
    private(set) var loaded = false
    private(set) var error: String?
    private let uid: String
    private let target: TeamChatTarget
    private let makeStorage: @Sendable () throws -> any TeamChatDraftStorage
    private var storage: (any TeamChatDraftStorage)?
    init(uid: String, target: TeamChatTarget, makeStorage: @escaping @Sendable () throws -> any TeamChatDraftStorage) {
        self.uid = uid; self.target = target; self.makeStorage = makeStorage
    }
    func clear() { body = ""; pending = nil; loaded = false; error = nil }
    func load() {
        guard !loaded else { return }
        do {
            let store = try store()
            let saved = try store.read(uid: uid, target: target)
            if let saved {
                try TeamChatWire.require(saved.uid == uid && saved.target == target && saved.body.utf16.count <= 16_384 &&
                    (saved.requestId == nil || TeamChatWire.validBody(TeamChatText.normalized(saved.body))))
            }
            body = saved?.body ?? ""; pending = saved?.requestId == nil ? nil : saved; loaded = true
            error = pending == nil ? nil : "Envoi non confirmé. Réessayez avec le même message."
        } catch { self.error = "Impossible de restaurer votre brouillon. Réessayez." }
    }
    func edit(_ value: String) {
        guard loaded, pending == nil else { return }
        guard value.utf16.count <= 16_384 else { error = "Le brouillon est trop long."; return }
        do {
            try store().write(.init(uid: uid, target: target, body: value, requestId: nil))
            body = value; error = nil
        } catch { self.error = "Impossible de conserver le brouillon. Réessayez." }
    }
    func prepare() -> (draft: TeamChatDraft, retrying: Bool)? {
        guard loaded, TeamChatWire.validBody(TeamChatText.normalized(body)) else { error = "Le message doit contenir au maximum 1 000 caractères."; return nil }
        let retrying = pending != nil
        let next = pending ?? .init(uid: uid, target: target, body: body, requestId: UUID())
        do { try store().write(next); pending = next; error = nil; return (next, retrying) }
        catch { self.error = "Impossible de conserver le message. Aucun nouvel envoi n’a été lancé."; return nil }
    }
    func acknowledge(_ expected: TeamChatDraft) {
        guard pending == expected else { return }
        do { try store().remove(expected); body = ""; pending = nil; error = nil }
        catch { self.error = "Message confirmé, mais le brouillon n’a pas pu être effacé. Réessayez." }
    }
    func reconcile(_ rows: [TeamChatMessage]) {
        guard let pending, let id = pending.requestId,
              rows.contains(where: { $0.senderId == uid && $0.requestId == id && $0.body == TeamChatText.normalized(pending.body) }) else { return }
        acknowledge(pending)
    }
    func failed(_ expected: TeamChatDraft, rejected: Bool, retrying: Bool) {
        guard pending == expected else { return }
        if rejected && !retrying {
            do {
                try store().releaseRejected(expected); pending = nil
                error = "Envoi refusé. Vérifiez le message et actualisez."
            } catch { self.error = "Envoi refusé, mais le brouillon reste verrouillé. Réessayez." }
        } else { error = "Envoi non confirmé. Réessayez avec le même message." }
    }
    private func store() throws -> any TeamChatDraftStorage {
        if let storage { return storage }
        let next = try makeStorage(); storage = next; return next
    }
}
