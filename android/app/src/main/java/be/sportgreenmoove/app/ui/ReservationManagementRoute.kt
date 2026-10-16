package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ReservationDecision
import be.sportgreenmoove.app.data.ReservationItem
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.ReservationGateway
import kotlinx.coroutines.launch

@Composable
internal fun ReservationManagementRoute(uid: String, role: AppRole, gateway: ReservationGateway, onChanged: suspend () -> Unit) {
    val state = remember(uid, role, gateway) { ReservationState(gateway, role) }
    val scope = rememberCoroutineScope()
    var confirmation by remember(state) { mutableStateOf<Pair<ReservationItem, ReservationDecision>?>(null) }
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state) { state.reload(onChanged) }
    val busy = state.loading || state.acting || state.loadingMore
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        V2Button("Actualiser", { scope.launch { state.reload(onChanged) } }, full = true, enabled = !busy,
            variant = V2ButtonVariant.Secondary, testTag = "bookings.refresh")
        if (state.error != null) Text(requireNotNull(state.error), style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.testTag("bookings.error"))
        else state.notice?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
        if (state.loading) Text("Chargement des réservations...", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        if (!busy && state.error == null && state.items.isEmpty()) Text("Aucune réservation.", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        BookingRequestsList(state.items, busy || state.requiresReload) { item, decision -> confirmation = item to decision }
        if (state.hasMore) V2Button(if (state.loadingMore) "Chargement..." else "Voir les réservations précédentes",
            { scope.launch { state.more() } }, full = true, enabled = !busy,
            variant = V2ButtonVariant.Secondary, testTag = "bookings.more")
    }
    confirmation?.let { (item, decision) ->
        AlertDialog(onDismissRequest = { confirmation = null },
            containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textSecondary,
            title = { Text("${decisionLabel(decision)} ?", style = SgmType.BodySM) },
            text = { Text(buildString {
                append(item.booking.title)
                append("\n${item.booking.seats} place${if (item.booking.seats > 1) "s" else ""}")
                if (decision == ReservationDecision.Cancel) append("\nCette action ne confirme pas de remboursement.")
            }, style = SgmType.BodySM) },
            confirmButton = { TextButton(onClick = {
                confirmation = null
                scope.launch { state.decide(item, decision, onChanged) }
            }, modifier = Modifier.testTag("bookings.confirm")) { Text("Confirmer", color = Sgm.colors.textPrimary) } },
            dismissButton = { TextButton(onClick = { confirmation = null }, modifier = Modifier.testTag("bookings.keep")) {
                Text("Revenir", color = Sgm.colors.textPrimary)
            } })
    }
}
