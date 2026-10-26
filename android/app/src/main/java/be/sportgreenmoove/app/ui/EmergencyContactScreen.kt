package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun EmergencyContactScreen(state: EmergencyContactState, canChooseChildren: Boolean, onBack: () -> Unit,
    onRefresh: () -> Unit, onSelf: () -> Unit, onChildren: () -> Unit, onSave: () -> Unit,
    onRemove: (EmergencyContactView) -> Unit, onDial: () -> Unit, onLinkAccount: ((EmergencyContactView) -> Unit)? = null) {
    V2Screen(testTag = "emergency.screen") {
        V2TopBar("CONTACT D’URGENCE", onBack = onBack, titleLines = 2, trailing = {
            EmergencyRefreshButton(state.busy, onRefresh)
        })
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            EmergencyContactButton("Mon contact", "emergency.self", !state.busy, onSelf)
            if (canChooseChildren) EmergencyContactButton("Contact d’un enfant", "emergency.children", !state.busy, onChildren)
            if (state.busy) Text("Chargement...", color = Sgm.colors.textSecondary, modifier = Modifier.testTag("emergency.loading"))
            state.error?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("emergency.error")) }
            state.notice?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("emergency.notice")) }
            state.view?.let { view ->
                Text(if (view.target is EmergencyContactTarget.Child) requireNotNull(view.childName) else "Votre contact",
                    style = SgmType.BodyLG, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("emergency.subject"))
                view.clubName?.let { Text(it, color = Sgm.colors.textSecondary) }
                if (canChooseChildren && view.target is EmergencyContactTarget.Child && onLinkAccount != null)
                    EmergencyContactButton("Lier le compte de cet enfant", "emergency.link-account", !state.busy, { onLinkAccount(view) })
                if (view.contact == null) Text("Aucun contact enregistré.", color = Sgm.colors.textSecondary,
                    modifier = Modifier.testTag("emergency.empty"))
                OutlinedTextField(state.name, state::editName, enabled = !state.busy, label = { Text("Nom du contact") },
                    maxLines = 3, modifier = Modifier.fillMaxWidth().testTag("emergency.name"))
                OutlinedTextField(state.phone, state::editPhone, enabled = !state.busy, label = { Text("Téléphone international") },
                    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    isError = state.phone.isNotEmpty() && !isEmergencyPhone(state.phone),
                    supportingText = { if (state.phone.isNotEmpty() && !isEmergencyPhone(state.phone))
                        Text("Saisissez un numéro avec indicatif international.") },
                    modifier = Modifier.fillMaxWidth().testTag("emergency.phone"))
                EmergencyContactButton("Enregistrer", "emergency.save", state.canSave, onSave, SgmIcon.Check)
                if (view.contact != null) {
                    EmergencyContactButton("Ouvrir le téléphone", "emergency.dial", state.canDial, onDial)
                    EmergencyContactButton("Supprimer le contact enregistré", "emergency.remove", !state.busy, { onRemove(view) })
                }
            }
        }
    }
}

@Composable
internal fun EmergencyContactButton(label: String, tag: String, enabled: Boolean, onClick: () -> Unit, icon: SgmIcon? = null) {
    OutlinedButton(onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag(tag),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Sgm.colors.textPrimary)) {
        if (icon != null) { SgmLineIcon(icon, tint = Sgm.colors.textPrimary, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)) }
        Text(label)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun EmergencyRefreshButton(loading: Boolean, onRefresh: () -> Unit) {
    TooltipBox(positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { PlainTooltip { Text("Actualiser") } }, state = rememberTooltipState()) {
        V2CircleIconButton(SgmIcon.Refresh, onRefresh, size = 44, enabled = !loading,
            testTag = "emergency.refresh", description = "Actualiser le contact")
    }
}
