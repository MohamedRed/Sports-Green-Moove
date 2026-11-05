import Foundation

enum EncodedRouteValidation {
    static func isValid(_ encoded: String) -> Bool {
        let bytes = Array(encoded.utf8)
        guard !bytes.isEmpty, bytes.count <= 200_000 else { return false }
        var index = 0, latitude: Int64 = 0, longitude: Int64 = 0, points = 0
        while index < bytes.count {
            guard let lat = delta(bytes, index: &index), let lng = delta(bytes, index: &index) else { return false }
            latitude += lat; longitude += lng
            guard (-9_000_000...9_000_000).contains(latitude), (-18_000_000...18_000_000).contains(longitude) else { return false }
            points += 1
        }
        return points >= 2
    }

    private static func delta(_ bytes: [UInt8], index: inout Int) -> Int64? {
        var result: Int64 = 0
        for shift in stride(from: 0, through: 30, by: 5) {
            guard index < bytes.count, (63...126).contains(bytes[index]) else { return nil }
            let byte = Int64(bytes[index]) - 63
            index += 1; result |= (byte & 31) << shift
            if byte < 32 { return result & 1 == 1 ? ~(result >> 1) : result >> 1 }
        }
        return nil
    }
}
