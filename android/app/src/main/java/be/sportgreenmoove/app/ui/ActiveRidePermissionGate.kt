package be.sportgreenmoove.app.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

class ActiveRidePermissionGate internal constructor(
    private val ensurePermissions: (() -> Unit) -> Unit,
) {
    fun runWhenReady(action: () -> Unit) {
        ensurePermissions(action)
    }
}

@Composable
fun rememberActiveRidePermissionGate(onBlocked: (String) -> Unit): ActiveRidePermissionGate {
    val context = androidx.compose.ui.platform.LocalContext.current
    var pendingAction by remember { mutableStateOf<(() -> Unit)?>(null) }
    var showDisclosure by remember { mutableStateOf(false) }
    var stage by remember { mutableStateOf(ActiveRidePermissionStage.Idle) }

    val foregroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        stage = nextStageAfterForeground(context)
    }
    val backgroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        stage = nextStageAfterBackground(context)
    }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        stage = nextStageAfterNotifications(context)
    }

    LaunchedEffect(stage) {
        when (stage) {
            ActiveRidePermissionStage.Idle -> Unit
            ActiveRidePermissionStage.Foreground -> {
                if (hasForegroundLocation(context)) {
                    stage = nextStageAfterForeground(context)
                } else {
                    foregroundLauncher.launch(foregroundLocationPermissions)
                }
            }
            ActiveRidePermissionStage.Background -> {
                if (hasBackgroundLocation(context)) {
                    stage = nextStageAfterBackground(context)
                } else {
                    backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                }
            }
            ActiveRidePermissionStage.Notifications -> {
                if (hasNotificationPermission(context)) {
                    stage = nextStageAfterNotifications(context)
                } else {
                    notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            ActiveRidePermissionStage.Complete -> {
                val action = pendingAction
                pendingAction = null
                stage = ActiveRidePermissionStage.Idle
                action?.invoke()
            }
            ActiveRidePermissionStage.Blocked -> {
                pendingAction = null
                stage = ActiveRidePermissionStage.Idle
                onBlocked(context.getString(R.string.active_ride_permission_blocked))
            }
        }
    }

    if (showDisclosure) {
        AlertDialog(
            onDismissRequest = {
                showDisclosure = false
                pendingAction = null
                onBlocked(context.getString(R.string.active_ride_permission_cancelled))
            },
            title = {
                Text(
                    stringResource(R.string.active_ride_permission_disclosure_title),
                    style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary),
                )
            },
            text = {
                Text(
                    stringResource(R.string.active_ride_permission_disclosure_body),
                    style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary),
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDisclosure = false
                        stage = firstMissingActiveRidePermission(context)
                    },
                ) {
                    Text(stringResource(R.string.active_ride_permission_continue))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showDisclosure = false
                        pendingAction = null
                        onBlocked(context.getString(R.string.active_ride_permission_cancelled))
                    },
                ) {
                    Text(stringResource(R.string.active_ride_permission_cancel))
                }
            },
        )
    }

    return ActiveRidePermissionGate { action ->
        if (hasAllActiveRidePermissions(context)) {
            action()
        } else {
            pendingAction = action
            showDisclosure = true
        }
    }
}

private enum class ActiveRidePermissionStage {
    Idle,
    Foreground,
    Background,
    Notifications,
    Complete,
    Blocked,
}

private val foregroundLocationPermissions = arrayOf(
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION,
)

private fun firstMissingActiveRidePermission(context: Context): ActiveRidePermissionStage =
    when {
        !hasForegroundLocation(context) -> ActiveRidePermissionStage.Foreground
        !hasBackgroundLocation(context) -> ActiveRidePermissionStage.Background
        !hasNotificationPermission(context) -> ActiveRidePermissionStage.Notifications
        else -> ActiveRidePermissionStage.Complete
    }

private fun hasAllActiveRidePermissions(context: Context): Boolean =
    hasForegroundLocation(context) &&
        hasBackgroundLocation(context) &&
        hasNotificationPermission(context)

private fun nextStageAfterForeground(context: Context): ActiveRidePermissionStage =
    if (!hasForegroundLocation(context)) {
        ActiveRidePermissionStage.Blocked
    } else if (!hasBackgroundLocation(context)) {
        ActiveRidePermissionStage.Background
    } else if (!hasNotificationPermission(context)) {
        ActiveRidePermissionStage.Notifications
    } else {
        ActiveRidePermissionStage.Complete
    }

private fun nextStageAfterBackground(context: Context): ActiveRidePermissionStage =
    if (!hasBackgroundLocation(context)) {
        ActiveRidePermissionStage.Blocked
    } else if (!hasNotificationPermission(context)) {
        ActiveRidePermissionStage.Notifications
    } else {
        ActiveRidePermissionStage.Complete
    }

private fun nextStageAfterNotifications(context: Context): ActiveRidePermissionStage =
    if (hasNotificationPermission(context)) {
        ActiveRidePermissionStage.Complete
    } else {
        ActiveRidePermissionStage.Blocked
    }

private fun hasForegroundLocation(context: Context): Boolean =
    context.hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)

private fun hasBackgroundLocation(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        context.hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)

private fun hasNotificationPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        context.hasPermission(Manifest.permission.POST_NOTIFICATIONS)

private fun Context.hasPermission(permission: String): Boolean =
    checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
