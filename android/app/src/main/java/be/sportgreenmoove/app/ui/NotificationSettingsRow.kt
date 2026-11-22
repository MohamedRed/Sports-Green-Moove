package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.notificationsAllowed
import be.sportgreenmoove.app.services.openNotificationSettings

@Composable
internal fun NotificationSettingsRow(showDivider: Boolean = false) {
    NotificationSettingsContent(rememberNotificationSettings(), showDivider)
}

@Composable
internal fun rememberNotificationSettings(): NotificationSettingsState {
    val context = LocalContext.current
    val state = remember(context) { NotificationSettingsState({ notificationsAllowed(context) }, { openNotificationSettings(context) }) }
    NotificationSettingsLifecycle(state)
    return state
}

@Composable
internal fun NotificationSettingsLifecycle(state: NotificationSettingsState) {
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner, state) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) state.refresh() }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
}

@Composable
internal fun NotificationSettingsContent(state: NotificationSettingsState, showDivider: Boolean = false) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().testTag("settings.notifications")
                .clickable(role = Role.Button, onClick = state::open)
                .heightIn(min = 56.dp).padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SgmLineIcon(SgmIcon.Bell, tint = Sgm.colors.textMuted, modifier = Modifier.size(18.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Notifications", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold))
                Text(if (state.allowed) "Autorisées sur ce téléphone" else "Bloquées sur ce téléphone",
                    modifier = Modifier.testTag("settings.notifications.status").semantics { liveRegion = LiveRegionMode.Polite },
                    style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp))
            }
            SgmLineIcon(SgmIcon.ChevronRight, tint = Sgm.colors.textMuted, modifier = Modifier.size(16.dp))
        }
        state.error?.let { error ->
            Text(error, Modifier.padding(horizontal = 16.dp).padding(bottom = 12.dp).testTag("settings.notifications.error")
                .semantics { liveRegion = LiveRegionMode.Polite }, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        }
        if (showDivider) Box(Modifier.padding(start = 46.dp).fillMaxWidth().height(1.dp).background(Sgm.colors.border))
    }
}
