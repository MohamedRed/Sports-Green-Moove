import Foundation

struct BookingAcknowledgement: Sendable {
    let bookingId: String
    let requestId: String
    let tripId: String
    let status: String
    let currentStatus: String
}
enum BookingResolution: Sendable {
    case committed(String)
    case abandoned
}
protocol BookingRequestTransport: Sendable {
    func submit(intent: PendingBookingIntent, uid: String, requestId: String) async throws -> BookingAcknowledgement
    func resolve(uid: String, requestId: String) async throws -> BookingResolution
}
enum BookingRecoveryError: LocalizedError {
    case storage, accountChanged, alreadyRecorded, alreadyProcessed, invalidReceipt, conflictingOperation
    var errorDescription: String? {
        switch self {
        case .storage: "Impossible de conserver la demande. Réessayez avant de quitter cet écran."
        case .accountChanged: "Le compte a changé. Reconnectez-vous pour continuer."
        case .alreadyRecorded: "Une demande précédente est déjà enregistrée. Consultez vos réservations avant de recommencer."
        case .alreadyProcessed: "Cette demande a déjà été traitée. Consultez vos réservations."
        case .invalidReceipt: "La confirmation de la réservation est invalide. Réessayez."
        case .conflictingOperation: "Une autre demande est en cours. Réessayez dans quelques instants."
        }
    }
}
struct BookingRequestCoordinator: Sendable {
    let store: PendingBookingStore
    let transport: any BookingRequestTransport
    let currentUid: @Sendable () -> String?

    func request(_ intent: PendingBookingIntent) async throws -> String {
        guard let uid = currentUid(), !uid.isEmpty else { throw BookingRecoveryError.accountChanged }
        let slot = BookingOperationSlot(uid: uid, tripId: intent.tripId, childId: intent.childId)
        var operation = try store.begin(slot: slot, intent: intent)
        if operation.intent != intent {
            let outcome = try await transport.resolve(uid: uid, requestId: operation.requestId)
            try requireAccount(uid)
            switch outcome {
            case .committed(let bookingId):
                guard !bookingId.isEmpty else { throw BookingRecoveryError.invalidReceipt }
                try store.acknowledge(slot: slot, requestId: operation.requestId)
                throw BookingRecoveryError.alreadyRecorded
            case .abandoned:
                try store.acknowledge(slot: slot, requestId: operation.requestId)
            }
            operation = try store.begin(slot: slot, intent: intent)
            guard operation.intent == intent else { throw BookingRecoveryError.conflictingOperation }
        }
        try requireAccount(uid)
        let receipt = try await transport.submit(intent: intent, uid: uid, requestId: operation.requestId)
        try requireAccount(uid)
        guard receipt.requestId == operation.requestId, receipt.tripId == intent.tripId,
              receipt.status == "requested", !receipt.bookingId.isEmpty,
              ["requested", "approved", "declined", "cancelled", "completed"].contains(receipt.currentStatus) else { throw BookingRecoveryError.invalidReceipt }
        try store.acknowledge(slot: slot, requestId: operation.requestId)
        guard ["requested", "approved"].contains(receipt.currentStatus) else { throw BookingRecoveryError.alreadyProcessed }
        return receipt.bookingId
    }
    private func requireAccount(_ uid: String) throws {
        guard currentUid() == uid else { throw BookingRecoveryError.accountChanged }
    }
}
