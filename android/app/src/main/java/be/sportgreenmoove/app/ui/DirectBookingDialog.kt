package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.AndroidProviderSet
import kotlinx.coroutines.CoroutineScope

@Composable
internal fun rememberDirectBookingState(providers: AndroidProviderSet, scope: CoroutineScope, uid: String?): DirectBookingState {
    val currentUid by rememberUpdatedState(uid)
    val state = remember(providers, scope, uid) {
        DirectBookingState(uid, providers.firebase, providers.reservations, scope) { currentUid }
    }
    DisposableEffect(state) { onDispose { state.close() } }
    return state
}

@Composable
internal fun DirectBookingDialog(state: DirectBookingState) {
    val trip = state.trip ?: return
    AlertDialog(
        onDismissRequest = state::dismiss,
        containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textSecondary,
        title = { Text(if (state.confirmation != null) "Votre réservation" else "Demander une place ?", style = SgmType.BodyLG) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(trip.title, style = SgmType.BodySM)
                Text(trip.departureLabel, style = SgmType.BodySM)
                Text("Pour vous · 1 place · ${trip.priceLabel}", style = SgmType.BodySM)
                if (state.loading) Text("Vérification en cours...", style = SgmType.BodySM)
                if (state.submitting) Text("Envoi en cours...", style = SgmType.BodySM)
                state.confirmation?.let { Text(it, style = SgmType.BodySM, modifier = Modifier.testTag("booking.direct.confirmed")) }
                state.error?.let { Text(it, style = SgmType.BodySM, modifier = Modifier.testTag("booking.direct.error")) }
            }
        },
        confirmButton = {
            if (state.confirmation == null) {
                if (!state.ready && !state.loading) TextButton(
                    onClick = state::reload, enabled = !state.submitting, modifier = Modifier.testTag("booking.direct.reload"),
                ) { Text("Actualiser", color = Sgm.colors.textPrimary) }
                else TextButton(onClick = state::confirm, enabled = state.canConfirm, modifier = Modifier.testTag("booking.direct.confirm")) {
                    Text(if (state.replyUnconfirmed) "Réessayer la même demande" else "Confirmer la demande", color = Sgm.colors.textPrimary)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = state::dismiss, enabled = !state.submitting, modifier = Modifier.testTag("booking.direct.dismiss")) {
                Text(if (state.confirmation != null) "Fermer" else "Revenir", color = Sgm.colors.textPrimary)
            }
        },
    )
}
