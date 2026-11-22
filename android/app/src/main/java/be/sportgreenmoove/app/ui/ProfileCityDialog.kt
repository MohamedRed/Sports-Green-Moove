package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm

@Composable
internal fun ProfileCityDialog(state: ProfileCityState, onClose: () -> Unit,
    onRefresh: () -> Unit, onSave: (Boolean) -> Unit) {
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard,
        titleContentColor = Sgm.colors.textPrimary, textContentColor = Sgm.colors.textPrimary,
        title = { Text("Ma ville") }, text = {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (state.busy) Text("Chargement...", Modifier.testTag("city.loading"))
                state.error?.let { Text(it, Modifier.testTag("city.error").semantics { liveRegion = LiveRegionMode.Polite }) }
                if (state.view != null) {
                    OutlinedTextField(state.input, state::edit, label = { Text("Ville") }, singleLine = true,
                        enabled = !state.busy && state.pending == null,
                        isError = state.input.isNotEmpty() && state.candidate == null,
                        modifier = Modifier.fillMaxWidth().testTag("city.input"))
                    if (state.view?.city != null && state.pending == null) TextButton(onClick = { onSave(true) },
                        enabled = !state.busy, modifier = Modifier.testTag("city.remove")) { Text("Supprimer la ville") }
                }
                if (state.error != null || state.view == null && !state.busy) TextButton(onClick = onRefresh,
                    enabled = !state.busy, modifier = Modifier.testTag("city.refresh")) { Text("Actualiser") }
            }
        }, confirmButton = {
            TextButton(onClick = { onSave(false) }, enabled = state.canSave, modifier = Modifier.testTag("city.save")) {
                Text(if (state.pending != null) "Réessayer" else "Enregistrer")
            }
        }, dismissButton = { TextButton(onClick = onClose, enabled = !state.busy,
            modifier = Modifier.testTag("city.cancel")) { Text("Fermer") } })
}
