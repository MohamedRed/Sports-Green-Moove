import Foundation

#if canImport(FirebaseFirestore)
import FirebaseFirestore

func mapTrip(id: String, data: [String: Any]) -> TripSummary {
    let departure = dateValue(data["departureAt"])
    let dateLabel = departure.map(formatDateLabel) ?? "DATE À CONFIRMER"
    let timeLabel = departure.map(formatTimeLabel) ?? "--h--"
    let seats = intValue(data["seatsAvailable"]) ?? 0
    let distance = data["distanceKm"] as? Double

    return TripSummary(
        id: id,
        title: data["title"] as? String ?? "\(data["category"] as? String ?? "Trajet") sportif",
        club: data["clubName"] as? String ?? data["clubId"] as? String ?? "Club",
        category: data["category"] as? String ?? "",
        sport: data["sport"] as? String ?? "Football",
        departureLabel: "\(dateLabel.replacingOccurrences(of: #"^[A-ZÀ-ÿ]{3}\\s"#, with: "", options: .regularExpression)) · \(timeLabel)",
        dateLabel: dateLabel,
        timeLabel: timeLabel,
        distanceLabel: distance.map { String(format: "%.1f km", $0) } ?? "Distance à confirmer",
        seatsAvailable: seats,
        priceLabel: priceLabel(intValue(data["priceCents"]) ?? 0),
        passengerInitials: data["passengerInitials"] as? [String] ?? [],
        reasons: ["\(seats) \(seats > 1 ? "places" : "place")", "Suivi véhicule disponible"],
        status: departure.map { $0 < Date() ? .past : .upcoming } ?? .upcoming
    )
}

func mapRide(_ data: [String: Any]) -> LiveRideSnapshot {
    LiveRideSnapshot(
        rideSessionId: data["rideSessionId"] as? String ?? "",
        status: data["status"] as? String ?? "Actif",
        vehicleLastUpdateLabel: data["vehicleLastUpdateLabel"] as? String ?? "En attente du premier point GPS",
        childLastUpdateLabel: data["childLastUpdateLabel"] as? String,
        etaLabel: data["etaLabel"] as? String ?? "ETA à calculer",
        stale: data["stale"] as? Bool ?? true,
        passengers: (data["passengers"] as? [[String: Any]] ?? []).map(mapRidePassenger)
    )
}

func mapRidePassenger(_ data: [String: Any]) -> RidePassengerStatus {
    RidePassengerStatus(
        bookingId: data["bookingId"] as? String ?? "",
        childId: data["childId"] as? String ?? "",
        label: data["label"] as? String ?? "Enfant",
        pickupStatus: data["pickupStatus"] as? String ?? "pending",
        dropoffStatus: data["dropoffStatus"] as? String ?? "pending"
    )
}

func mapPayableBooking(id: String, booking: [String: Any], trip: [String: Any]) -> PayableBookingSummary? {
    let seats = intValue(booking["seats"]) ?? 1
    guard let tripId = booking["tripId"] as? String,
          let priceCents = intValue(trip["priceCents"])
    else { return nil }
    let amountCents = seats * priceCents
    guard amountCents > 0 else { return nil }
    let departure = dateValue(trip["departureAt"])

    return PayableBookingSummary(
        id: id,
        tripId: tripId,
        title: trip["title"] as? String ?? "\(trip["category"] as? String ?? "Trajet") sportif",
        club: trip["clubName"] as? String ?? trip["clubId"] as? String ?? "Club",
        dateLabel: departure.map(formatDateLabel) ?? "DATE À CONFIRMER",
        timeLabel: departure.map(formatTimeLabel) ?? "--h--",
        seats: seats,
        amountCents: amountCents,
        amountLabel: priceLabel(amountCents),
        paymentStatus: booking["paymentStatus"] as? String ?? "required"
    )
}

private func dateValue(_ value: Any?) -> Date? {
    if let timestamp = value as? Timestamp { return timestamp.dateValue() }
    if let date = value as? Date { return date }
    if let text = value as? String { return ISO8601DateFormatter().date(from: text) }
    return nil
}

private func formatDateLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_BE")
    formatter.dateFormat = "EEE dd MMM"
    return formatter.string(from: date).replacingOccurrences(of: ".", with: "").uppercased()
}

private func formatTimeLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_BE")
    formatter.dateFormat = "HH'h'mm"
    return formatter.string(from: date)
}

private func priceLabel(_ cents: Int) -> String {
    guard cents > 0 else { return "Gratuit" }
    return String(format: "%.2f EUR", Double(cents) / 100).replacingOccurrences(of: ".", with: ",")
}

private func intValue(_ value: Any?) -> Int? {
    if let int = value as? Int { return int }
    if let number = value as? NSNumber { return number.intValue }
    return nil
}
#endif
