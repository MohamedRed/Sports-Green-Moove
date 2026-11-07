import Foundation
public enum FirestoreSource: Sendable { case server }
public let FirestoreErrorDomain = "FIRFirestoreErrorDomain"
public enum FirestoreErrorCode: Int { case permissionDenied = 7, notFound = 5 }
public protocol ListenerRegistration: AnyObject { func remove() }
private final class Registration: ListenerRegistration { func remove() {} }
public struct Timestamp: Sendable {
    public let seconds: Int64
    public let nanoseconds: Int32
    public init(seconds: Int64, nanoseconds: Int32) { self.seconds = seconds; self.nanoseconds = nanoseconds }
}
public final class FieldPath: Sendable { public static func documentID() -> FieldPath { FieldPath() } }
public final class SnapshotMetadata: Sendable {
    public var isFromCache: Bool { false }
    public var hasPendingWrites: Bool { false }
}
public final class QueryDocumentSnapshot: Sendable {
    public var documentID: String { "fixture" }
    public func data() -> [String: Any] { [:] }
}
public final class QuerySnapshot: Sendable {
    public var documents: [QueryDocumentSnapshot] { [] }
    public var metadata: SnapshotMetadata { SnapshotMetadata() }
}
public final class DocumentSnapshot: Sendable {
    public var documentID: String { "fixture" }
    public var exists: Bool { true }
    public var metadata: SnapshotMetadata { SnapshotMetadata() }
    public func data() -> [String: Any]? { [:] }
}
public final class DocumentReference: Sendable {
    public func addSnapshotListener(includeMetadataChanges: Bool,
        listener: @escaping @Sendable (DocumentSnapshot?, (any Error)?) -> Void) -> any ListenerRegistration { Registration() }
}
// Query's real Objective-C declaration is NS_SWIFT_SENDABLE, including its subclasses.
public class Query: @unchecked Sendable {
    public func order(by: FieldPath) -> Query { self }
    public func order(by: String) -> Query { self }
    public func order(by: String, descending: Bool) -> Query { self }
    public func order(by: FieldPath, descending: Bool) -> Query { self }
    public func limit(to: Int) -> Query { self }
    public func start(after: [Any]) -> Query { self }
    public func whereField(_ field: String, isEqualTo value: Any) -> Query { self }
    public func whereField(_ field: String, arrayContains value: Any) -> Query { self }
    public func addSnapshotListener(includeMetadataChanges: Bool,
        listener: @escaping @Sendable (QuerySnapshot?, (any Error)?) -> Void) -> any ListenerRegistration { Registration() }
    public func getDocuments(source: FirestoreSource, completion: @escaping @Sendable (QuerySnapshot?, (any Error)?) -> Void) { }
}
public final class CollectionReference: Query, @unchecked Sendable {
    public func document(_ path: String) -> DocumentReference { DocumentReference() }
}
public final class Firestore: Sendable {
    public static func firestore() -> Firestore { Firestore() }
    public func collection(_ name: String) -> CollectionReference { CollectionReference() }
}
