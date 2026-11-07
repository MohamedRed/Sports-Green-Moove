package be.sportgreenmoove.app.services

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

internal const val teamPushWorkTag = "sgm-team-alert-work"
internal fun enqueueTeamPushAlert(context: Context, request: TeamPushOpenRequest) {
    val work = OneTimeWorkRequestBuilder<TeamPushDeliveryWorker>().setInputData(workDataOf(
        "notificationId" to request.notificationId, "ownerUid" to request.uid, "epoch" to request.epoch))
        .addTag(teamPushWorkTag).build()
    WorkManager.getInstance(context).enqueueUniqueWork(teamPushWorkName(request), ExistingWorkPolicy.KEEP, work)
}
internal fun cancelTeamPushWork(context: Context) { WorkManager.getInstance(context).cancelAllWorkByTag(teamPushWorkTag) }

class TeamPushDeliveryWorker internal constructor(context: Context, parameters: WorkerParameters,
    private val display: suspend (TeamPushOpenRequest) -> Boolean) : CoroutineWorker(context, parameters) {
    constructor(context: Context, parameters: WorkerParameters) : this(context, parameters,
        { request -> AndroidTeamPushRuntime.displayAlert(context.applicationContext, request) })
    override suspend fun doWork(): Result {
        return try {
            withTimeout(25_000L) {
                val request = TeamPushOpenRequest(inputData.getString("notificationId") ?: return@withTimeout Result.failure(),
                    inputData.getString("ownerUid") ?: return@withTimeout Result.failure(), inputData.getLong("epoch", -1))
                if (display(request)) Result.success() else Result.failure()
            }
        } catch (_: TimeoutCancellationException) { Result.failure() }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { Result.failure() }
    }
}
