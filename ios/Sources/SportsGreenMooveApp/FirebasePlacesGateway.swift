import Foundation

#if canImport(FirebaseAuth) && canImport(FirebaseFunctions)
extension FirebaseBackendGateway {
    func suggestPlaces(uid: String, input: String) async throws -> [PlaceSuggestion] {
        try await firebaseOwnedCall(uid: uid, name: "suggestPlaces", input: ["input": PlaceSearchWire.query(input)], decode: PlaceSearchWire.suggestions)
    }
    func resolvePlace(uid: String, placeId: String) async throws -> ResolvedPlace {
        try await firebaseOwnedCall(uid: uid, name: "resolvePlace", input: ["placeId": PlaceSearchWire.placeId(placeId)], decode: PlaceSearchWire.resolved)
    }
}
#endif
