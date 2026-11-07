package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm

@Composable
internal fun EmergencyChildDialog(page: GuardianPageState<GuardianVerification>, onChoose: (GuardianVerification) -> Unit,
    onMore: () -> Unit, onRetry: () -> Unit, onClose: () -> Unit) {
    val verified = page.items.filter { it.status == GuardianVerificationStatus.Verified }
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary,
        textContentColor = Sgm.colors.textPrimary, title = { Text("Choisir un enfant") }, text = {
            Column(Modifier.fillMaxWidth().heightIn(max = 400.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (page.busy) Text("Chargement...")
                page.error?.let { Text(it); TextButton(onClick = onRetry, enabled = !page.busy) { Text("Actualiser", color = Sgm.colors.textPrimary) } }
                if (page.loaded && verified.isEmpty() && !page.hasMore) Text("Aucun lien vérifié disponible.")
                verified.forEach { item ->
                    OutlinedButton(onClick = { onChoose(item) }, enabled = !page.busy && item.childName != null && item.clubName != null,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("emergency.child.${item.id}")) {
                        Column(Modifier.fillMaxWidth()) {
                            Text(item.childName ?: "Nom de l’enfant indisponible", color = Sgm.colors.textPrimary)
                            Text(item.clubName ?: "Nom du club indisponible", color = Sgm.colors.textSecondary)
                        }
                    }
                }
                if (page.hasMore) TextButton(onClick = onMore, enabled = !page.busy, modifier = Modifier.testTag("emergency.children.more")) {
                    Text("Liens suivants", color = Sgm.colors.textPrimary)
                }
            }
        }, confirmButton = { TextButton(onClick = onClose, modifier = Modifier.testTag("emergency.children.close")) {
            Text("Fermer", color = Sgm.colors.textPrimary)
        } })
}

@Composable
internal fun EmergencyConfirmation(title: String, description: String, confirmLabel: String, onClose: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(onDismissRequest = onClose, containerColor = Sgm.colors.bgCard, titleContentColor = Sgm.colors.textPrimary,
        textContentColor = Sgm.colors.textPrimary, title = { Text(title) },
        text = { Text(description, modifier = Modifier.verticalScroll(rememberScrollState())) },
        confirmButton = { TextButton(onClick = onConfirm, modifier = Modifier.testTag("emergency.confirm")) {
            Text(confirmLabel, color = Sgm.colors.textPrimary)
        } }, dismissButton = { TextButton(onClick = onClose, modifier = Modifier.testTag("emergency.keep")) {
            Text("Revenir", color = Sgm.colors.textPrimary)
        } })
}
