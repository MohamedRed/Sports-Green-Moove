import Foundation

#if canImport(FirebaseCore) && canImport(FirebaseAuth) && canImport(FirebaseFirestore) && canImport(FirebaseFunctions)
import FirebaseAuth
import FirebaseFunctions

extension FirebaseBackendGateway {
    func emergencyContact(uid: String, scope: EmergencyContactScope) async throws -> EmergencyContactView? {
        let name: String; let input: [String: Any]
        switch scope {
        case let .managed(target): name = "getEmergencyContact"; input = ["target": try EmergencyContactWire.targetPayload(target)]
        case .childRide(nil): name = "getCurrentChildRideEmergencyContact"; input = [:]
        case let .childRide(id?):
            try EmergencyContactWire.require(EmergencyContactWire.validId(id))
            name = "getChildRideEmergencyContact"; input = ["rideSessionId": id]
        }
        return try await contactCall(uid: uid, name: name, input: input) {
            try EmergencyContactWire.view($0, uid: uid, scope: scope)
        }
    }
    func saveEmergencyContact(uid: String, operation: EmergencyContactOperation) async throws -> Int64 {
        try await contactCall(uid: uid, name: "saveEmergencyContact", input: EmergencyContactWire.payload(operation)) {
            try EmergencyContactWire.receipt($0, uid: uid, operation: operation)
        }
    }
    private func contactCall<Response: Sendable>(uid: String, name: String, input: [String: Any],
        decode: @escaping @Sendable (Any?) throws -> Response) async throws -> Response {
        try Task.checkCancellation()
        guard !uid.isEmpty, Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        let response: Response = try await withCheckedThrowingContinuation { continuation in
            Functions.functions().httpsCallable(name).call(input) { result, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(with: Result { try decode(result?.data) }) }
            }
        }
        try Task.checkCancellation()
        guard Auth.auth().currentUser?.uid == uid else { throw CancellationError() }
        return response
    }
}
#endif
