package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.ProfileCity
import be.sportgreenmoove.app.data.ProfileCityChange
import be.sportgreenmoove.app.services.ProfileCityGateway
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class ProfileCityStateTest {
    @Test fun doesNotInventACityAndSavesOnlyTheNormalizedValue() = runBlocking {
        val gateway = CityFixture(); val state = ready(gateway)
        assertNull(state.view?.city); assertEquals("", state.input); assertFalse(state.canSave)
        state.edit(" Lie\u0300ge "); assertTrue(state.canSave); assertTrue(state.save())
        assertEquals("Liège", state.view?.city); assertEquals(1L, state.view?.revision)
        assertEquals("Liège", ready(gateway).view?.city)
    }
    @Test fun editingAndCancellingNeverWrites() = runBlocking {
        val gateway = CityFixture(); val state = ready(gateway)
        state.edit("Wavre"); state.discard(); assertEquals("", state.input); assertTrue(gateway.writes.isEmpty())
        state.edit("a\u202eb"); assertFalse(state.canSave); assertFalse(state.save()); assertTrue(gateway.writes.isEmpty())
    }
    @Test fun removalIsExplicitAndKeepsTheNewRevision() = runBlocking {
        val gateway = CityFixture().apply { current = ProfileCity("parent", "Wavre", 3) }; val state = ready(gateway)
        state.edit(""); assertFalse(state.canSave); assertTrue(state.save(remove = true))
        assertNull(state.view?.city); assertEquals(4L, state.view?.revision); assertNull(gateway.writes.single().city)
    }
    @Test fun lostReplyKeepsOneExactRetryIdentityAndCannotChangeItsPayload() = runBlocking {
        val gateway = CityFixture().apply { loseReply = true }; val state = ready(gateway)
        state.edit("Liège"); assertFalse(state.save()); assertNull(state.view?.city); assertNotNull(state.pending)
        val pending = state.pending; state.edit("Namur"); assertEquals("Liège", state.input)
        gateway.loseReply = false; assertTrue(state.save()); assertEquals(pending, gateway.writes.last())
        assertEquals(2, gateway.writes.size); assertEquals(1L, state.view?.revision); assertNull(state.pending)
    }
    @Test fun readingAfterALostReplyReconcilesTheSavedCityWithoutAnotherWrite() = runBlocking {
        val gateway = CityFixture().apply { loseReply = true }; val state = ready(gateway)
        state.edit("Namur"); state.save(); state.refresh()
        assertEquals("Namur", state.view?.city); assertNull(state.pending); assertEquals(1, gateway.writes.size)
    }
    @Test fun failedReadDoesNotLookLikeAnUnsetCityOrEnableSaving() = runBlocking {
        val gateway = CityFixture().apply { failRead = true }; val state = ready(gateway)
        assertNull(state.view); assertNotNull(state.error); assertFalse(state.canSave)
        state.discard(); assertNotNull(state.error)
        state.edit("Wavre"); assertFalse(state.save()); assertTrue(gateway.writes.isEmpty())
        gateway.failRead = false; state.refresh(); assertNotNull(state.view); assertNull(state.error)
    }
    @Test fun closingDiscardsLateReadsFromTheOldAccount() = runBlocking {
        val gateway = CityFixture().apply { heldRead = CompletableDeferred() }; val state = ProfileCityState("parent", gateway)
        val reading = launch(start = CoroutineStart.UNDISPATCHED) { state.refresh() }; state.close()
        gateway.heldRead!!.complete(ProfileCity("parent", "Wavre", 1)); reading.join()
        assertNull(state.view); assertEquals("", state.input); assertFalse(state.canSave)
    }
    @Test fun closingDiscardsLateWriteResultsFromTheOldAccount() = runBlocking {
        val gateway = CityFixture().apply { heldWrite = CompletableDeferred() }; val state = ready(gateway); state.edit("Wavre")
        val writing = async(start = CoroutineStart.UNDISPATCHED) { state.save() }; state.close()
        gateway.heldWrite!!.complete(Unit); assertFalse(writing.await()); assertNull(state.view); assertEquals("", state.input)
    }
    @Test fun foreignReadAndWriteResponsesCannotPopulateTheProfile() = runBlocking {
        val gateway = CityFixture().apply { current = ProfileCity("other", "Wavre", 1) }; val state = ready(gateway)
        assertNull(state.view); assertNotNull(state.error)
        gateway.current = ProfileCity("parent", null, 0); state.refresh(); state.edit("Liège")
        gateway.foreignReply = true; assertFalse(state.save()); assertNull(state.view?.city); assertNotNull(state.pending)
    }
    @Test fun simultaneousSaveTapsCannotCreateTwoOperations() = runBlocking {
        val gateway = CityFixture().apply { heldWrite = CompletableDeferred() }; val state = ready(gateway); state.edit("Wavre")
        val first = async(start = CoroutineStart.UNDISPATCHED) { state.save() }
        assertFalse(state.save()); state.edit("Namur"); assertEquals("Wavre", state.input)
        gateway.heldWrite!!.complete(Unit); assertTrue(first.await()); assertEquals(1, gateway.writes.size)
    }
    private suspend fun ready(gateway: CityFixture) = ProfileCityState("parent", gateway).also { it.refresh() }
}

private class CityFixture : ProfileCityGateway {
    var current = ProfileCity("parent", null, 0)
    var failRead = false; var loseReply = false; var foreignReply = false
    var heldRead: CompletableDeferred<ProfileCity>? = null
    var heldWrite: CompletableDeferred<Unit>? = null
    val writes = mutableListOf<ProfileCityChange>()
    override suspend fun readProfileCity(uid: String): ProfileCity {
        if (failRead) error("Isolated read failure")
        return heldRead?.await() ?: current
    }
    override suspend fun saveProfileCity(uid: String, change: ProfileCityChange): ProfileCity {
        if (writes.lastOrNull() != change) {
            check(current.revision == change.expectedRevision)
            current = ProfileCity(uid, change.city, change.expectedRevision + 1)
        }
        writes += change; heldWrite?.await()
        if (loseReply) error("Isolated response loss")
        return if (foreignReply) current.copy(userId = "other") else current
    }
}
