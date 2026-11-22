package be.sportgreenmoove.app.services

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TeamPushPlatformFlowTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val request = TeamPushOpenRequest("teamChat_" + "a".repeat(64), "synthetic-parent", 1)
    private fun worker(display: suspend (TeamPushOpenRequest) -> Boolean): TeamPushDeliveryWorker =
        TestListenableWorkerBuilder<TeamPushDeliveryWorker>(context).setInputData(workDataOf(
            "notificationId" to request.notificationId, "ownerUid" to request.uid, "epoch" to request.epoch))
            .setWorkerFactory(object : WorkerFactory() {
                override fun createWorker(appContext: Context, workerClassName: String, workerParameters: WorkerParameters): ListenableWorker =
                    TeamPushDeliveryWorker(appContext, workerParameters, display)
            }).build()

    @Test fun workerCannotSucceedUntilTheInjectedDisplayOperationHasActuallyCompleted() = runTest {
        val hold = CompletableDeferred<Unit>(); var completed = false
        val work = worker { assertEquals(request, it); hold.await(); completed = true; true }
        var result: ListenableWorker.Result? = null
        val job = launch { result = work.doWork() }; runCurrent(); assertFalse(completed); assertNull(result)
        hold.complete(Unit); job.join(); assertTrue(completed); assertEquals(ListenableWorker.Result.success(), result)
    }
    @Test fun suppressedFailedAndTimedOutOperationsAreFailuresNotAutomaticRetries() = runTest {
        for (display in listOf<suspend (TeamPushOpenRequest) -> Boolean>({ false }, { error("Synthetic display failure") },
            { kotlinx.coroutines.delay(30_000); true }))
            assertEquals(ListenableWorker.Result.failure(), worker(display).doWork())
    }
    @Test fun immutableExplicitIntentKeepsOnlyTheOpaqueRequestAndNoTeamOrMessagePayload() {
        val intent = teamPushOpenIntent(context, request)
        assertEquals(request, teamPushOpenRequest(intent)); assertEquals("be.sportgreenmoove.app.MainActivity", intent.component?.className)
        assertEquals(setOf("notificationId", "ownerUid", "epoch"), intent.extras!!.keySet())
        assertNull(teamPushOpenRequest(intent.setAction("untrusted-action")))
        assertNull(teamPushOpenRequest(teamPushOpenIntent(context, request).putExtra("notificationId", "../invalid")))
        assertNull(teamPushOpenRequest(teamPushOpenIntent(context, request).putExtra("epoch", 0L)))
    }
    @Test fun nativeGenericNotificationIsIdempotentWhileVisibleAndCleanupLeavesOtherNotificationsAlone() {
        assumeTrue("Explicit disposable notification-permission trial only",
            InstrumentationRegistry.getArguments().getString("sgmTeamAlertPlatform") == "true")
        val manager = context.getSystemService(NotificationManager::class.java)
        val originalChannel = manager.getNotificationChannel(teamPushChannelId)
        val control = "synthetic-other-notification"
        try {
            createTeamPushChannel(context); check(teamNotificationsAllowed(context))
            manager.notify(control, 901, Notification.Builder(context, teamPushChannelId).setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Contrôle QA").build())
            postTeamPushNotification(context, request); postTeamPushNotification(context, request)
            val posted = manager.activeNotifications.filter { it.tag == teamPushWorkName(request) }; assertEquals(1, posted.size)
            val notification = posted.single().notification
            assertEquals(teamPushAlertTitle, notification.extras.getString(Notification.EXTRA_TITLE))
            assertEquals(teamPushAlertBody, notification.extras.getString(Notification.EXTRA_TEXT))
            assertTrue(notification.contentIntent.isImmutable); assertEquals(Notification.VISIBILITY_PRIVATE, notification.visibility)
            clearTeamPushNotifications(context)
            assertTrue(manager.activeNotifications.none { it.tag?.startsWith(teamPushNotificationPrefix) == true })
            assertTrue(manager.activeNotifications.any { it.tag == control })
        } finally {
            manager.cancel(control, 901); clearTeamPushNotifications(context)
            if (originalChannel == null) manager.deleteNotificationChannel(teamPushChannelId)
        }
    }
}
