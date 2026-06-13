import Foundation

enum MapRoutePolyline {
    static func points(for preview: MapRoutePreview) -> [MapPoint] {
        let decoded = preview.encodedPolyline.flatMap { $0.isEmpty ? nil : decode($0) } ?? []
        return decoded.count >= 2 ? decoded : [preview.start, preview.end]
    }

    static func decode(_ encoded: String) -> [MapPoint] {
        var points: [MapPoint] = []
        var index = encoded.startIndex
        var lat = 0
        var lng = 0

        while index < encoded.endIndex {
            let latitude = decodeValue(encoded, from: index)
            index = latitude.nextIndex
            let longitude = decodeValue(encoded, from: index)
            index = longitude.nextIndex
            lat += latitude.delta
            lng += longitude.delta
            points.append(MapPoint(lat: Double(lat) / 100_000, lng: Double(lng) / 100_000))
        }

        return points
    }

    private static func decodeValue(_ encoded: String, from startIndex: String.Index) -> DecodedValue {
        var result = 0
        var shift = 0
        var index = startIndex
        var byte = 0

        repeat {
            precondition(index < encoded.endIndex, "Invalid encoded polyline.")
            byte = Int(encoded[index].asciiValue ?? 63) - 63
            index = encoded.index(after: index)
            result |= (byte & 0x1f) << shift
            shift += 5
        } while byte >= 0x20

        let delta = (result & 1) != 0 ? ~(result >> 1) : result >> 1
        return DecodedValue(delta: delta, nextIndex: index)
    }

    private struct DecodedValue {
        let delta: Int
        let nextIndex: String.Index
    }
}
