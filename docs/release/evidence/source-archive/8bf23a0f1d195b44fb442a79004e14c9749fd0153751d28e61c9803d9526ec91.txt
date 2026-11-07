import Foundation

func mapRoutePreviewFromTripData(_ data: [String: Any]) -> MapRoutePreview? {
    guard let start = mapPoint(data["origin"]),
          let end = mapPoint(data["destination"])
    else { return nil }
    return MapRoutePreview(
        start: start,
        end: end,
        encodedPolyline: data["encodedPolyline"] as? String
    )
}

func mapRoutePreviewFromMatchData(summary: [String: Any], route: [String: Any]?) -> MapRoutePreview? {
    let preview = mapRoutePreviewFromTripData(summary) ?? mapRoutePreview(summary["mapPreview"])
    guard let encodedPolyline = route?["finalEncodedPolyline"] as? String,
          !encodedPolyline.isEmpty
    else {
        return preview
    }
    return preview.map { MapRoutePreview(start: $0.start, end: $0.end, encodedPolyline: encodedPolyline) }
}

private func mapRoutePreview(_ value: Any?) -> MapRoutePreview? {
    guard let data = value as? [String: Any],
          let start = mapPoint(data["start"]),
          let end = mapPoint(data["end"])
    else { return nil }
    return MapRoutePreview(
        start: start,
        end: end,
        encodedPolyline: data["encodedPolyline"] as? String
    )
}

private func mapPoint(_ value: Any?) -> MapPoint? {
    guard let data = value as? [String: Any],
          let lat = mapDouble(data["lat"]),
          let lng = mapDouble(data["lng"])
    else { return nil }
    return MapPoint(lat: lat, lng: lng)
}

private func mapDouble(_ value: Any?) -> Double? {
    if let double = value as? Double { return double }
    if let number = value as? NSNumber { return number.doubleValue }
    if let int = value as? Int { return Double(int) }
    return nil
}
