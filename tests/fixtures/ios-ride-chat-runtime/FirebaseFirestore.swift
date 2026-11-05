import Foundation

public enum FirestoreSource: Sendable { case server }
public let FirestoreErrorDomain = "FIRFirestoreErrorDomain"
public enum FirestoreErrorCode: Int { case permissionDenied = 7, notFound = 5 }
public protocol ListenerRegistration: AnyObject { func remove() }
public struct Timestamp: Sendable {
    public let seconds: Int64
    public let nanoseconds: Int32
    public init(seconds: Int64, nanoseconds: Int32) { self.seconds = seconds; self.nanoseconds = nanoseconds }
}
public final class FieldPath: Sendable { public static func documentID() -> FieldPath { FieldPath() } }
public struct SnapshotMetadata: Sendable {
    public let isFromCache: Bool
    public let hasPendingWrites: Bool
    public init(cache: Bool = false, pending: Bool = false) { isFromCache = cache; hasPendingWrites = pending }
}
// Test-only immutable, copied payloads cross scripted SDK callbacks, never production.
public final class DocumentSnapshot: @unchecked Sendable {
    public let documentID: String
    public let exists: Bool
    public let metadata: SnapshotMetadata
    private let fields: [String: Any]
    public init(id: String, data: [String: Any], exists: Bool = true, metadata: SnapshotMetadata = .init()) {
        documentID = id; fields = data; self.exists = exists; self.metadata = metadata
    }
    public func data() -> [String: Any]? { exists ? fields : nil }
}
public final class QueryDocumentSnapshot: @unchecked Sendable {
    public let documentID: String
    private let fields: [String: Any]
    public init(id: String, data: [String: Any]) { documentID = id; fields = data }
    public func data() -> [String: Any] { fields }
}
public struct QuerySnapshot: Sendable {
    public let documents: [QueryDocumentSnapshot]
    public let metadata: SnapshotMetadata
    public init(documents: [QueryDocumentSnapshot] = [], metadata: SnapshotMetadata = .init()) { self.documents = documents; self.metadata = metadata }
}
private final class Registration: ListenerRegistration {
    private let id: UUID
    init(_ id: UUID) { self.id = id }
    func remove() { TestFirestore.shared.remove(id) }
}
public final class TestFirestore: @unchecked Sendable {
    public static let shared = TestFirestore()
    private let lock = NSLock()
    private var queries: [UUID: (String, @Sendable (QuerySnapshot?, (any Error)?) -> Void)] = [:]
    private var documents: [UUID: (String, @Sendable (DocumentSnapshot?, (any Error)?) -> Void)] = [:]
    private var removedQueries: [String: [@Sendable (QuerySnapshot?, (any Error)?) -> Void]] = [:]
    private var removedDocuments: [String: [@Sendable (DocumentSnapshot?, (any Error)?) -> Void]] = [:]
    public var listenerCount: Int { lock.lock(); defer { lock.unlock() }; return queries.count + documents.count }
    public func queryCount(_ path: String) -> Int { lock.lock(); defer { lock.unlock() }; return queries.values.filter { $0.0 == path }.count }
    fileprivate func query(_ path: String, _ callback: @escaping @Sendable (QuerySnapshot?, (any Error)?) -> Void) -> any ListenerRegistration {
        lock.lock(); defer { lock.unlock() }; let id = UUID(); queries[id] = (path, callback); return Registration(id)
    }
    fileprivate func document(_ path: String, _ callback: @escaping @Sendable (DocumentSnapshot?, (any Error)?) -> Void) -> any ListenerRegistration {
        lock.lock(); defer { lock.unlock() }; let id = UUID(); documents[id] = (path, callback); return Registration(id)
    }
    fileprivate func remove(_ id: UUID) {
        lock.lock(); defer { lock.unlock() }
        if let (path, callback) = queries.removeValue(forKey: id) { removedQueries[path, default: []].append(callback) }
        if let (path, callback) = documents.removeValue(forKey: id) { removedDocuments[path, default: []].append(callback) }
    }
    public func emitDocument(_ path: String, _ snapshot: DocumentSnapshot?, error: (any Error)? = nil, late: Bool = false) {
        lock.lock(); let callbacks = late ? removedDocuments[path] ?? [] : documents.values.filter { $0.0 == path }.map(\.1); lock.unlock()
        callbacks.forEach { $0(snapshot, error) }
    }
    public func emitQuery(_ path: String, _ snapshot: QuerySnapshot?, error: (any Error)? = nil, late: Bool = false) {
        lock.lock(); let callbacks = late ? removedQueries[path] ?? [] : queries.values.filter { $0.0 == path }.map(\.1); lock.unlock()
        callbacks.forEach { $0(snapshot, error) }
    }
}
public final class DocumentReference: Sendable {
    private let path: String
    init(_ path: String) { self.path = path }
    public func addSnapshotListener(includeMetadataChanges: Bool, listener: @escaping @Sendable (DocumentSnapshot?, (any Error)?) -> Void) -> any ListenerRegistration {
        TestFirestore.shared.document(path, listener)
    }
}
public class Query: @unchecked Sendable {
    fileprivate let path: String
    init(_ path: String) { self.path = path }
    public func whereField(_ field: String, arrayContains: Any) -> Query { self }
    public func whereField(_ field: String, isEqualTo: Any) -> Query { self }
    public func order(by: String, descending: Bool) -> Query { self }
    public func order(by: FieldPath, descending: Bool) -> Query { self }
    public func limit(to: Int) -> Query { self }
    public func start(after: [Any]) -> Query { self }
    public func addSnapshotListener(includeMetadataChanges: Bool, listener: @escaping @Sendable (QuerySnapshot?, (any Error)?) -> Void) -> any ListenerRegistration {
        TestFirestore.shared.query(path, listener)
    }
    public func getDocuments(source: FirestoreSource, completion: @escaping @Sendable (QuerySnapshot?, (any Error)?) -> Void) {
        completion(nil, NSError(domain: "controlled-not-configured", code: 1))
    }
}
public final class CollectionReference: Query, @unchecked Sendable {
    public func document(_ path: String) -> DocumentReference { DocumentReference(self.path + "/" + path) }
}
public final class Firestore: Sendable {
    public static func firestore() -> Firestore { Firestore() }
    public func collection(_ path: String) -> CollectionReference { CollectionReference(path) }
}
