import Foundation

#if canImport(UIKit)
import UIKit

@MainActor struct SystemEmergencyPhone: EmergencyPhoneOpening {
    func open(_ contact: PersonalEmergencyContact) async -> EmergencyPhoneResult {
        guard contact.isValid, let url = URL(string: "tel:" + contact.phone) else { return .unavailable }
        let opened = await withCheckedContinuation { continuation in
            UIApplication.shared.open(url, options: [:]) { continuation.resume(returning: $0) }
        }
        return opened ? .opened : .unavailable
    }
}
#endif
