package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.BookingIntentSnapshot
import be.sportgreenmoove.app.data.MapPoint
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class BookingRequestCoordinatorTest {
    private val intent = PendingBookingIntent("trip", "child", 2, BookingIntentSnapshot("2027-01-10T10:00:00.000Z", null,
        MapPoint(50.7, 4.6), MapPoint(50.8, 4.3), 250, "driver", 4))
    private val slot = BookingSlot("parent", "trip", "child")
    private class Storage : BookingOperationStorage {
        val rows = mutableMapOf<BookingSlot, PendingBookingOperation>()
        var failWrites = false
        var failAfterMemoryUpdate = false
        override fun read(slot: BookingSlot) = rows[slot]
        override fun write(slot: BookingSlot, operation: PendingBookingOperation?) {
            check(!failWrites)
            if (operation == null) rows.remove(slot) else rows[slot] = operation
            check(!failAfterMemoryUpdate) { "Cached value was not persisted" }
        }
    }
    private class Transport : BookingRequestTransport {
        val sent = mutableListOf<Pair<String, Map<String, Any>>>()
        var action: suspend (String, Map<String, Any>) -> Map<*, *> = { _, data ->
            mapOf("currentBookingStatus" to "requested", "bookingId" to "saved", "clientRequestId" to data["clientRequestId"], "status" to "requested",
                "trip" to mapOf("id" to data["tripId"]))
        }
        override suspend fun call(name: String, payload: Map<String, Any>): Map<*, *> {
            sent += name to payload; return action(name, payload)
        }
    }
    @Test fun aLostReplySurvivesGatewayRecreationAndRetainsSeatsChildAndTerms() = runBlocking {
        val disk = Storage(); val transport = Transport()
        transport.action = { _, _ -> error("Reply lost after commit") }
        assertTrue(runCatching { BookingRequestCoordinator(PendingBookingOperations(disk), transport) { "parent" }.request(intent) }.isFailure)
        val id = disk.rows.getValue(slot).requestId
        transport.action = { _, data -> mapOf("currentBookingStatus" to "requested", "bookingId" to "saved", "clientRequestId" to data["clientRequestId"],
            "status" to "requested", "trip" to mapOf("id" to "trip")) }
        assertEquals("saved", BookingRequestCoordinator(PendingBookingOperations(disk), transport) { "parent" }.request(intent))
        assertEquals(2, transport.sent.size)
        assertEquals(transport.sent[0].second, transport.sent[1].second)
        assertEquals(id, transport.sent[1].second["clientRequestId"])
        assertEquals("parent", transport.sent[1].second["requesterUserId"])
        assertEquals(2, transport.sent[1].second["seats"])
        assertEquals("child", transport.sent[1].second["childId"])
        assertEquals(intent.terms.toCallablePayload(), transport.sent[1].second["expectedBookingIntent"])
        assertNull(disk.read(slot))
    }
    @Test fun anAcknowledgedNewExplicitOperationReceivesANewIdentity() = runBlocking {
        val transport = Transport(); val coordinator = BookingRequestCoordinator(PendingBookingOperations(Storage()), transport) { "parent" }
        coordinator.request(intent); coordinator.request(intent)
        assertNotEquals(transport.sent[0].second["clientRequestId"], transport.sent[1].second["clientRequestId"])
    }
    @Test fun changedDetailsResolveTheOldAttemptBeforeCreatingANewOne() = runBlocking {
        val disk = Storage(); val store = PendingBookingOperations(disk); val old = store.begin(slot, intent)
        val transport = Transport()
        transport.action = { name, data -> if (name == "resolveBookingRequest")
            mapOf("clientRequestId" to data["clientRequestId"], "state" to "abandoned") else
            mapOf("currentBookingStatus" to "requested", "bookingId" to "new", "clientRequestId" to data["clientRequestId"], "status" to "requested", "trip" to mapOf("id" to "trip")) }
        BookingRequestCoordinator(store, transport) { "parent" }.request(intent.copy(seats = 3))
        assertEquals(listOf("resolveBookingRequest", "requestBooking"), transport.sent.map { it.first })
        assertEquals(old.requestId, transport.sent[0].second["clientRequestId"])
        assertNotEquals(old.requestId, transport.sent[1].second["clientRequestId"])
        assertEquals(3, transport.sent[1].second["seats"])
    }
    @Test fun aCommittedOldIntentDoesNotSilentlySendTheChangedSelection() = runBlocking {
        val disk = Storage(); val store = PendingBookingOperations(disk); store.begin(slot, intent)
        val transport = Transport(); transport.action = { _, data -> mapOf("clientRequestId" to data["clientRequestId"], "state" to "committed", "bookingId" to "old") }
        val error = runCatching { BookingRequestCoordinator(store, transport) { "parent" }.request(intent.copy(seats = 3)) }.exceptionOrNull()
        assertTrue(error is ProviderConfigurationException)
        assertEquals(listOf("resolveBookingRequest"), transport.sent.map { it.first })
        assertNull(disk.read(slot))
    }
    @Test fun failedResolutionKeepsTheOldIdentityAndDoesNotSubmitChangedDetails() = runBlocking {
        val disk = Storage(); val store = PendingBookingOperations(disk); val old = store.begin(slot, intent)
        val transport = Transport(); transport.action = { _, _ -> error("Lost resolution response") }
        assertTrue(runCatching { BookingRequestCoordinator(store, transport) { "parent" }.request(intent.copy(seats = 3)) }.isFailure)
        assertEquals(old, disk.read(slot)); assertEquals(1, transport.sent.size)
    }
    @Test fun malformedOrMismatchedAcknowledgementsCannotClearThePendingIdentity() = runBlocking {
        for (response in listOf(emptyMap<String, Any>(), mapOf("currentBookingStatus" to "requested", "bookingId" to "other", "clientRequestId" to "wrong"))) {
            val disk = Storage(); val transport = Transport(); transport.action = { _, _ -> response }
            assertTrue(runCatching { BookingRequestCoordinator(PendingBookingOperations(disk), transport) { "parent" }.request(intent) }.isFailure)
            assertNotNull(disk.read(slot))
        }
    }
    @Test fun accountsHaveSeparateIdentitiesAndAChangedAccountCannotAcknowledgeAnOldRequest() = runBlocking {
        val disk = Storage(); val store = PendingBookingOperations(disk)
        val parent = store.begin(slot, intent); val otherSlot = slot.copy(uid = "other")
        assertNotEquals(parent.requestId, store.begin(otherSlot, intent).requestId)
        var uid = "parent"; val transport = Transport()
        transport.action = { _, data -> uid = "other"; mapOf("currentBookingStatus" to "requested", "bookingId" to "old", "clientRequestId" to data["clientRequestId"],
            "status" to "requested", "trip" to mapOf("id" to "trip")) }
        assertTrue(runCatching { BookingRequestCoordinator(store, transport) { uid }.request(intent) }.isFailure)
        assertEquals(parent, disk.read(slot))
    }
    @Test fun storageFailurePreventsAnyNetworkSubmission() = runBlocking {
        val disk = Storage().also { it.failWrites = true }; val transport = Transport()
        assertTrue(runCatching { BookingRequestCoordinator(PendingBookingOperations(disk), transport) { "parent" }.request(intent) }.isFailure)
        assertTrue(transport.sent.isEmpty())
    }
    @Test fun aLateAcknowledgementCannotRemoveADifferentPendingOperation() {
        val disk = Storage(); val store = PendingBookingOperations(disk)
        val old = store.begin(slot, intent); store.acknowledge(slot, old.requestId)
        val newer = store.begin(slot, intent.copy(seats = 3))
        store.acknowledge(slot, old.requestId)
        assertEquals(newer, disk.read(slot))
    }
    @Test fun aRecoveredClosedBookingDoesNotPretendANewRequestWasSent() = runBlocking {
        for (status in listOf("cancelled", "declined", "completed")) {
            val disk = Storage(); val store = PendingBookingOperations(disk); store.begin(slot, intent)
            val transport = Transport(); transport.action = { _, data -> mapOf("bookingId" to "old",
                "clientRequestId" to data["clientRequestId"], "status" to "requested", "currentBookingStatus" to status,
                "trip" to mapOf("id" to "trip")) }
            val error = runCatching { BookingRequestCoordinator(store, transport) { "parent" }.request(intent) }.exceptionOrNull()
            assertTrue(error is ProviderConfigurationException); assertNull(disk.read(slot)); assertEquals(1, transport.sent.size)
        }
    }
    @Test fun aCachedIdentityAfterFailedDiskWriteCannotBypassDurabilityOnRetry() = runBlocking {
        val disk = Storage().also { it.failAfterMemoryUpdate = true }; val transport = Transport()
        val first = BookingRequestCoordinator(PendingBookingOperations(disk), transport) { "parent" }
        assertTrue(runCatching { first.request(intent) }.isFailure)
        val cached = checkNotNull(disk.read(slot))
        val recreated = BookingRequestCoordinator(PendingBookingOperations(disk), transport) { "parent" }
        assertTrue(runCatching { recreated.request(intent) }.isFailure)
        assertTrue(transport.sent.isEmpty())
        disk.failAfterMemoryUpdate = false
        assertEquals("saved", recreated.request(intent))
        assertEquals(cached.requestId, transport.sent.single().second["clientRequestId"])
    }
}
