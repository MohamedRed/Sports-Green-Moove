package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.ReceivedRatingSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.ReceivedRatingsGateway
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

@Composable
internal fun ProfileReceivedRatings(uid: String, gateway: ReceivedRatingsGateway) {
    key(uid, gateway) {
        val state = remember { ReceivedRatingsState(uid, gateway) }
        val owner = LocalLifecycleOwner.current
        val scope = rememberCoroutineScope()
        DisposableEffect(state) { onDispose { state.close() } }
        LaunchedEffect(state, owner) {
            owner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) { state.refresh(); awaitCancellation() }
        }
        ReceivedRatingsRow(state.summary, state.busy, state.failed) { scope.launch { state.refresh() } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReceivedRatingsRow(summary: ReceivedRatingSummary?, busy: Boolean, failed: Boolean, onRefresh: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).heightIn(min = 72.dp)
        .sgmTestTag("profile.received-ratings"), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val text = when {
                busy -> "Chargement des avis..."
                failed -> "Avis indisponibles"
                summary == null -> "Chargement des avis..."
                summary.count == 0L -> "Aucun avis reçu"
                else -> String.format(Locale.FRANCE, "%.1f / 5", summary.average)
            }
            Text(text, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.SemiBold),
                modifier = Modifier.sgmTestTag("profile.received-ratings.value"))
            if (!busy && !failed && summary != null && summary.count > 0) {
                Text("${NumberFormat.getIntegerInstance(Locale.FRANCE).format(summary.count)} avis ${if (summary.count == 1L) "reçu" else "reçus"}",
                    style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary),
                    modifier = Modifier.sgmTestTag("profile.received-ratings.count"))
            }
        }
        TooltipBox(positionProvider = TooltipDefaults.rememberTooltipPositionProvider(),
            tooltip = { PlainTooltip { Text("Actualiser les avis") } }, state = rememberTooltipState()) {
            V2CircleIconButton(SgmIcon.Refresh, onClick = onRefresh, size = 48, enabled = !busy,
                testTag = "profile.received-ratings.refresh", description = "Actualiser les avis")
        }
    }
}
