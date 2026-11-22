import Foundation
import Observation

@MainActor @Observable
final class PaymentScreenController {
    private let access: AccountAccess
    private var active = true
    private var revision = UUID()
    private var pending: UUID?
    var loading: Bool { pending != nil || access.waitingForEarlierWork }
    var acceptsAction: Bool { active && access.isCurrent && !loading }

    init(access: AccountAccess) { self.access = access }

    func activate() {
        guard access.isCurrent, !active else { return }
        active = true; revision = UUID()
    }

    func close() { active = false; revision = UUID() }

    func startConnect(email: String?, urls: (returnUrl: String, refreshUrl: String)?, gateway: StripePaymentsGateway,
        openURL: (URL) -> Void, onError: (String?) -> Void, onNotice: (String?) -> Void) async {
        guard acceptsAction, access.context.role == .driver, access.context.grantedRoles.contains(.driver),
              let work = access.begin() else { return }
        let request = UUID(), generation = revision
        pending = request
        defer { access.finish(work); if pending == request { pending = nil } }
        func current() -> Bool {
            active && revision == generation && pending == request && access.owns(work)
        }
        func requireCurrent() throws { guard current() else { throw CancellationError() } }
        onError(nil)
        guard current() else { return }
        onNotice(nil)
        guard current() else { return }
        guard let email = email?.trimmingCharacters(in: .whitespacesAndNewlines), !email.isEmpty else {
            onError("Ajoutez une adresse e-mail à votre compte pour continuer."); return
        }
        guard gateway.isConfigured, let urls, secureURL(urls.returnUrl) != nil, secureURL(urls.refreshUrl) != nil else {
            onError(Self.unavailableMessage); return
        }
        do {
            _ = try await gateway.createStripeAccount(email: email)
            try requireCurrent()
            let link = try await gateway.createStripeAccountLink(returnUrl: urls.returnUrl, refreshUrl: urls.refreshUrl)
            try requireCurrent()
            guard let url = secureURL(link.url) else { onError(Self.unavailableMessage); return }
            openURL(url)
            try requireCurrent()
            onNotice("Poursuivez l'inscription dans votre navigateur.")
        } catch {
            guard current() else { return }
            onError("Impossible d'ouvrir l'inscription conducteur. Réessayez.")
        }
    }

    private func secureURL(_ value: String) -> URL? {
        guard let url = URL(string: value), url.scheme == "https", let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil else { return nil }
        return url
    }

    static let unavailableMessage = "L'inscription conducteur est indisponible pour le moment. Contactez le support."
}
