public enum FirestoreSource: Sendable { case server }
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
public final class Query: Sendable {
    public func order(by: FieldPath) -> Query { self }
    public func order(by: String) -> Query { self }
    public func limit(to: Int) -> Query { self }
    public func start(after: [Any]) -> Query { self }
    public func whereField(_ field: String, isEqualTo value: Any) -> Query { self }
    public func getDocuments(source: FirestoreSource, completion: @escaping @Sendable (QuerySnapshot?, (any Error)?) -> Void) { }
}
public final class Firestore: Sendable {
    public static func firestore() -> Firestore { Firestore() }
    public func collection(_ name: String) -> Query { Query() }
}
