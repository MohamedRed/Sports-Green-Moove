package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.TripCancellationReady
import be.sportgreenmoove.app.data.TripCancellationReceipt
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.TripCancellationGateway
import kotlinx.coroutines.launch

@Composable
internal fun TripCancellationDialog(
    uid: String, role: AppRole, trip: TripSummary, gateway: TripCancellationGateway,
    onChanged: suspend () -> Unit, onDismiss: () -> Unit,
) {
    val state = remember(uid, role, trip.id, gateway) { TripCancellationState(trip.id, gateway) }
    val scope = rememberCoroutineScope()
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state) { state.reload(onChanged) }
    AlertDialog(
        onDismissRequest = { if (!state.busy) onDismiss() },
        containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textSecondary,
        title = { Text(if (state.confirmed) "Trajet annulé" else "Annuler le trajet ?", style = SgmType.BodyLG,
            modifier = Modifier.testTag("trip.cancel.title")) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(trip.title, style = SgmType.BodySM)
                if (state.busy) Text("Vérification en cours...", style = SgmType.BodySM)
                state.preview?.let { preview ->
                    Text("${preview.bookingCount} réservation${if (preview.bookingCount > 1) "s" else ""} concernée${if (preview.bookingCount > 1) "s" else ""}.",
                        style = SgmType.BodySM, modifier = Modifier.testTag("trip.cancel.count"))
                    if (preview.refundPendingCount > 0) Text(
                        if (preview is TripCancellationReady)
                            "${preview.refundPendingCount} réservation${if (preview.refundPendingCount > 1) "s" else ""} payée${if (preview.refundPendingCount > 1) "s" else ""}. Le remboursement restera à vérifier."
                        else "${preview.refundPendingCount} remboursement${if (preview.refundPendingCount > 1) "s" else ""} en attente. Aucun remboursement n'est confirmé ici.",
                        style = SgmType.BodySM, modifier = Modifier.testTag("trip.cancel.refunds"))
                    if (preview is TripCancellationReady) OutlinedTextField(
                        value = state.reason, onValueChange = state::editReason, enabled = state.canEdit,
                        label = { Text("Motif de l'annulation") }, supportingText = { Text("5 à 300 caractères") },
                        modifier = Modifier.fillMaxWidth().testTag("trip.cancel.reason"), minLines = 2, maxLines = 4,
                    )
                    if (preview is TripCancellationReceipt) Text(preview.reason, style = SgmType.BodySM,
                        modifier = Modifier.testTag("trip.cancel.recorded"))
                }
                state.notice?.let { Text(it, style = SgmType.BodySM) }
                state.error?.let { Text(it, style = SgmType.BodySM, modifier = Modifier.testTag("trip.cancel.error")) }
            }
        },
        confirmButton = {
            if (state.requiresReload || state.preview == null) TextButton(
                onClick = { scope.launch { state.reload(onChanged) } }, enabled = !state.busy,
                modifier = Modifier.testTag("trip.cancel.refresh"),
            ) { Text("Actualiser", color = Sgm.colors.textPrimary) }
            else if (!state.confirmed) TextButton(
                onClick = { scope.launch { state.confirm(onChanged) } }, enabled = state.canConfirm,
                modifier = Modifier.testTag("trip.cancel.confirm"),
            ) { Text("Confirmer l'annulation", color = Sgm.colors.textPrimary) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !state.busy, modifier = Modifier.testTag("trip.cancel.keep")) {
                Text(if (state.confirmed) "Fermer" else "Revenir", color = Sgm.colors.textPrimary)
            }
        },
    )
}
