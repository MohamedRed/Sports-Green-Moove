package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.TripChangeDecision
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant

@Composable
internal fun TripChangeDialog(
    uid: String, role: AppRole, tripId: String, title: String, proposalId: String?, gateway: FirebaseGateway,
    onChanged: suspend () -> Unit, onDismiss: () -> Unit,
) {
    val state = remember(uid, role, tripId, gateway) { TripChangeState(tripId, uid, role, gateway) }
    val scope = rememberCoroutineScope()
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, proposalId) { state.reload(proposalId, onChanged) }
    LaunchedEffect(state.quote?.quoteId) {
        val quote = state.quote ?: return@LaunchedEffect
        delay((Instant.parse(quote.expiresAt).toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(1))
        state.expireQuote(quote.quoteId)
    }
    Dialog(onDismissRequest = { if (!state.busy) onDismiss() }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(color = Sgm.colors.bgCard, modifier = Modifier.padding(12.dp).widthIn(max = 640.dp).fillMaxWidth().fillMaxHeight(0.94f).imePadding()) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(Modifier.fillMaxWidth()) {
                    Text("Modification du trajet", style = SgmType.BodyLG.copy(color = Sgm.colors.textPrimary), modifier = Modifier.weight(1f).testTag("trip.change.title"))
                    IconButton(onDismiss, enabled = !state.busy, modifier = Modifier.semantics { contentDescription = "Fermer" }) {
                        SgmLineIcon(SgmIcon.ChevronLeft, tint = Sgm.colors.textPrimary, modifier = Modifier.size(20.dp))
                    }
                }
                Text(title, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
                if (state.busy) Text("Vérification en cours...", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary), modifier = Modifier.testTag("trip.change.busy"))
                state.preview?.let { preview ->
                    Text("${preview.parentCount} parent${if (preview.parentCount > 1) "s" else ""} · ${preview.bookingCount} réservation${if (preview.bookingCount > 1) "s" else ""}",
                        style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
                    state.draft?.let { TripChangeEditorForm(it, state.canEdit, gateway) }
                    V2Button("Proposer les changements", { scope.launch { state.propose(onChanged) } }, full = true,
                        enabled = state.canPropose, testTag = "trip.change.propose")
                }
                state.review?.let { review ->
                    TripChangeReviewContent(review)
                    if (state.canRespond) {
                        V2Button("Accepter les nouveaux détails", { scope.launch { state.decide(TripChangeDecision.Accept, onChanged) } },
                            full = true, testTag = "trip.change.accept")
                        V2Button("Refuser les changements", { scope.launch { state.decide(TripChangeDecision.Decline, onChanged) } },
                            full = true, variant = V2ButtonVariant.Secondary, testTag = "trip.change.decline")
                    }
                    state.quote?.let { quote ->
                        Text("${quote.distanceMeters} m · ${quote.durationSeconds / 60} min", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary),
                            modifier = Modifier.testTag("trip.change.quote"))
                    }
                    if (state.canQuote) V2Button("Calculer l’itinéraire", { scope.launch { state.calculateRoute() } }, full = true,
                        variant = V2ButtonVariant.Secondary, testTag = "trip.change.calculate")
                    if (state.canApply) V2Button("Appliquer les détails confirmés", { scope.launch { state.apply(onChanged) } },
                        full = true, testTag = "trip.change.apply")
                    if (state.canWithdraw) V2Button("Retirer la proposition", { scope.launch { state.withdraw(onChanged) } },
                        full = true, variant = V2ButtonVariant.Secondary, testTag = "trip.change.withdraw")
                }
                state.application?.let { receipt ->
                    Text("Détails appliqués. ${receipt.settlementRequiredCount} règlement${if (receipt.settlementRequiredCount > 1) "s" else ""} à vérifier.",
                        style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.testTag("trip.change.applied"))
                }
                state.error?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.testTag("trip.change.error")) }
                if (state.requiresReload || (state.preview == null && state.review == null)) V2Button("Actualiser", {
                    scope.launch { state.reload(proposalId, onChanged) }
                }, full = true, enabled = !state.busy, variant = V2ButtonVariant.Secondary, testTag = "trip.change.refresh")
                else if (state.review != null) V2Button("Actualiser les accords", { scope.launch { state.reload(proposalId, onChanged) } },
                    full = true, enabled = !state.busy, variant = V2ButtonVariant.Secondary, testTag = "trip.change.refresh")
            }
        }
    }
}
