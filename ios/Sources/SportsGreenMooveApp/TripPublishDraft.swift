import Foundation

struct TripPublishDraft: Hashable, Sendable {
    let title: String
    let sport: String
    let clubName: String
    let teamName: String
    let clubId: String
    let teamId: String
    let category: String
    let departureAtIso: String
    let origin: ResolvedPlace
    let destination: ResolvedPlace
    let pickupRadiusM: Int
    let seatsTotal: Int
    let seatsAvailable: Int
    let baggage: String
    let returnTrip: Bool
    let priceCents: Int
    let supportsVehicleTracking: Bool
    let supportsChildTracking: Bool
    let co2SavedKgEstimate: Double
    var distanceKm: Double?

    func callablePayload() -> [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "sport": sport,
            "clubName": clubName,
            "teamName": teamName,
            "clubId": clubId,
            "teamId": teamId,
            "category": category,
            "departureAt": departureAtIso,
            "origin": ["lat": origin.lat, "lng": origin.lng],
            "destination": ["lat": destination.lat, "lng": destination.lng],
            "pickupRadiusM": pickupRadiusM,
            "seatsTotal": seatsTotal,
            "seatsAvailable": seatsAvailable,
            "baggage": baggage,
            "returnTrip": returnTrip,
            "priceCents": priceCents,
            "supportsVehicleTracking": supportsVehicleTracking,
            "supportsChildTracking": supportsChildTracking,
            "co2SavedKgEstimate": co2SavedKgEstimate,
        ]
        if let distanceKm {
            payload["distanceKm"] = distanceKm
        }
        return payload
    }
}
