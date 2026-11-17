import Foundation
import UIKit

@main struct PhoneBoundaryChecks {
    @MainActor static func main() async {
        let opener = SystemEmergencyPhone()
        precondition(UIApplication.shared.requests.isEmpty)
        for phone in ["0470000000", "+32470000001\n", "tel:+32470000001", "+32470000001;123"] {
            let result = await opener.open(PersonalEmergencyContact(name: "Contact fictif", phone: phone))
            guard case .unavailable = result else { fatalError("Unsafe phone input reached the boundary") }
        }
        precondition(UIApplication.shared.requests.isEmpty)
        let contact = PersonalEmergencyContact(name: "Contact fictif", phone: "+32470000001")
        let accepted = await opener.open(contact)
        guard case .opened = accepted else { fatalError("Accepted controlled opening lost its outcome") }
        precondition(UIApplication.shared.requests.count == 1)
        precondition(UIApplication.shared.requests[0].absoluteString == "tel:" + contact.phone)
        UIApplication.shared.accepted = false
        let denied = await opener.open(contact)
        guard case .unavailable = denied else { fatalError("Rejected controlled opening claimed success") }
        precondition(UIApplication.shared.requests.count == 2)
        print("EmergencyPhoneBoundaryChecks passed: 4 invalid inputs denied, exact tel destination, explicit request only, rejected opening without retry; controlled UIKit, no phone app or call")
    }
}
