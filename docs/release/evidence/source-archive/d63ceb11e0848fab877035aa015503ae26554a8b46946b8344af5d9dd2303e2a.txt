package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.TeamConversationGateway
import be.sportgreenmoove.app.services.TeamPushAlertGateway
import be.sportgreenmoove.app.services.TeamPushOpenRequest
import kotlinx.coroutines.awaitCancellation

@Composable
internal fun TeamPushOpenRoute(request: TeamPushOpenRequest, uid: String, adult: Boolean, alerts: TeamPushAlertGateway?,
    conversations: TeamConversationGateway?, attempt: Long = 0, onClose: () -> Unit) {
    var refresh by remember { mutableIntStateOf(0) }
    val state = remember(request, uid, adult, alerts, attempt, refresh) { TeamPushOpenState(request, uid, adult, alerts) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(state) { onDispose(state::close) }
    LaunchedEffect(state, owner, refresh) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { state.load(); awaitCancellation() } finally { state.hide() }
        }
    }
    val target = state.target
    if (state.phase == TeamPushOpenPhase.Open && target != null && conversations != null) {
        TeamConversationRoute(uid, target, conversations, onClose)
    } else {
        BackHandler(onBack = onClose)
        Column(Modifier.fillMaxSize().background(Sgm.colors.bgApp).sgmTestTag("team-alert.open")) {
            V2TopBar("ÉQUIPE", onBack = onClose)
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(when (state.phase) {
                    TeamPushOpenPhase.Loading -> "Ouverture de la notification..."
                    TeamPushOpenPhase.Retry -> "Impossible d’ouvrir cette notification. Réessayez."
                    else -> "Cette notification n’est plus disponible."
                }, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary), modifier = Modifier.sgmTestTag("team-alert.status"))
                if (state.phase == TeamPushOpenPhase.Retry)
                    V2Button("Réessayer", { refresh++ }, testTag = "team-alert.retry")
            }
        }
    }
}
