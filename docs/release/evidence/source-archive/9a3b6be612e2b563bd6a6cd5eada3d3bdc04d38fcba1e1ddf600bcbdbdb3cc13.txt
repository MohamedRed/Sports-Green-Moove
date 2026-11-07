import Foundation

struct ReviewTripContext: Hashable, Sendable {
    let tripId: String
    let title: String
    let departureAt: String
    let departureLabel: String
}

struct InboxReviewPrompt: Identifiable, Hashable, Sendable {
    let id: String
    let rideSessionId: String
    let ratedUserId: String
    let title: String
    let prompt: String
    let initials: String
    var tripContext: ReviewTripContext? = nil
}
