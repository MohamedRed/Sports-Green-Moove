import Foundation

enum ParentReservationError: Error { case invalidResponse, unavailable }
enum ParentReservationStatus: String, Sendable {
    case requested, approved, declined, cancelled, completed
    var historical: Bool { self == .declined || self == .cancelled || self == .completed }
    var label: String {
        switch self {
        case .requested: return "En attente"
        case .approved: return "Approuvée"
        case .declined: return "Refusée"
        case .cancelled: return "Annulée"
        case .completed: return "Terminée"
        }
    }
}

struct ParentReservation: Identifiable, Equatable, Sendable {
    let id: String
    let tripId: String
    let parentUid: String
    let childLabel: String?
    let seats: Int
    let status: ParentReservationStatus
    let title: String
    let club: String
    let date: String
    let time: String
    let price: String
    let canCancel: Bool
    let refundPending: Bool
    let tripChangeId: String?
}

struct ParentReservationPage: Sendable {
    let userId: String
    let items: [ParentReservation]
    let cursor: String?
}

struct ParentCancellationReceipt: Equatable, Sendable { let bookingId: String }

protocol ParentReservationGateway: Sendable {
    func parentReservations(uid: String, cursor: String?) async throws -> ParentReservationPage
    func cancelParentReservation(uid: String, bookingId: String) async throws -> ParentCancellationReceipt
}
