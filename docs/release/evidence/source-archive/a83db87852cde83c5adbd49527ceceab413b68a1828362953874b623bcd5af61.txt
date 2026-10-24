package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.GuardianOption
import be.sportgreenmoove.app.design.Sgm

@Composable
internal fun TeamEnrollmentOptionDialog(title: String, page: GuardianPageState<GuardianOption>, selected: String?,
    onChoose: (String) -> Unit, onMore: () -> Unit, onRetry: () -> Unit, onClose: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary,
        textContentColor = Sgm.colors.textPrimary, title = { Text(title) },
        text = { Column(Modifier.fillMaxWidth().heightIn(max = 360.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (page.busy) Text("Chargement...")
            page.error?.let { Text(it); TextButton(onClick = onRetry, enabled = !page.busy) { Text("Actualiser", color = Sgm.colors.textPrimary) } }
            if (page.loaded && page.items.isEmpty() && !page.hasMore) Text("Aucun choix disponible.")
            page.items.forEach { option ->
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("team-enrollment.option.${option.id}")
                    .selectable(selected == option.id, enabled = !page.busy && option.name != null, role = Role.RadioButton, onClick = { onChoose(option.id) })) {
                    RadioButton(selected == option.id, onClick = null, enabled = !page.busy && option.name != null)
                    Text(option.name ?: "Nom indisponible", modifier = Modifier.weight(1f).padding(vertical = 12.dp))
                }
            }
            if (page.hasMore) TextButton(onClick = onMore, enabled = !page.busy, modifier = Modifier.testTag("team-enrollment.options.more")) {
                Text("Autres choix", color = Sgm.colors.textPrimary)
            }
        } }, confirmButton = { TextButton(onClick = onClose) { Text("Fermer", color = Sgm.colors.textPrimary) } })
}
