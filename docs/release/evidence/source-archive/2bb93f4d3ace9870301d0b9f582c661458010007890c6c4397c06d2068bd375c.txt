import Foundation
import CoreFoundation

struct ReceivedRatingSummary: Equatable, Sendable {
    let userId: String
    let count: Int64
    let average: Double?

    func validate(uid: String) throws {
        guard !uid.isEmpty, userId == uid, (0...9_007_199_254_740_991).contains(count) else {
            throw ReceivedRatingsError.invalidResponse
        }
        if count == 0 {
            guard average == nil else { throw ReceivedRatingsError.invalidResponse }; return
        }
        guard let average, average.isFinite, (1...5).contains(average) else { throw ReceivedRatingsError.invalidResponse }
    }
}

protocol ReceivedRatingsGateway: Sendable {
    func receivedRatings(uid: String) async throws -> ReceivedRatingSummary
}

enum ReceivedRatingsError: Error { case invalidResponse }

enum ReceivedRatingsWire {
    static func parse(_ value: Any?, uid: String) throws -> ReceivedRatingSummary {
        guard let value = value as? [String: Any], let userId = value["userId"] as? String,
              let count = value["count"] as? NSNumber, CFGetTypeID(count) != CFBooleanGetTypeID() else {
            throw ReceivedRatingsError.invalidResponse
        }
        let number = count.doubleValue
        guard number.isFinite, number >= 0, number <= 9_007_199_254_740_991, number.rounded() == number else {
            throw ReceivedRatingsError.invalidResponse
        }
        let average: Double?
        if value["average"] is NSNull { average = nil }
        else {
            guard let score = value["average"] as? NSNumber, CFGetTypeID(score) != CFBooleanGetTypeID() else {
                throw ReceivedRatingsError.invalidResponse
            }
            average = score.doubleValue
        }
        let result = ReceivedRatingSummary(userId: userId, count: Int64(number), average: average)
        try result.validate(uid: uid); return result
    }
}
