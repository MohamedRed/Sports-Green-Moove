package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.launch

@Composable
internal fun ChildRideEmergencyRoute(uid: String, rideId: String, gateway: EmergencyContactGateway, onBack: () -> Unit,
    launchDialer: ((PersonalEmergencyContact) -> EmergencyDialerResult)? = null) {
    val state = remember(uid, rideId, gateway) { ChildRideEmergencyState(uid, rideId, gateway) }
    val owner = LocalLifecycleOwner.current; val scope = rememberCoroutineScope(); val context = LocalContext.current
    DisposableEffect(state) { onDispose { state.close() } }
    LaunchedEffect(state, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { state.refresh(); kotlinx.coroutines.awaitCancellation() }
            finally { state.leaveForeground() }
        }
    }
    V2Screen(testTag = "emergency.child-ride.screen") {
        V2TopBar("CONTACT D’URGENCE", onBack, trailing = {
            EmergencyRefreshButton(state.busy) { scope.launch { state.refresh() } }
        })
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (state.busy) Text("Chargement...", color = Sgm.colors.textSecondary)
            state.error?.let { Text(it, color = Sgm.colors.textPrimary, modifier = Modifier.testTag("emergency.child-ride.error")) }
            state.notice?.let { Text(it, color = Sgm.colors.textPrimary) }
            state.view?.let { view ->
                Text(view.childName, style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                val contact = view.contact
                if (contact == null) Text("Aucun contact enregistré.", color = Sgm.colors.textPrimary,
                    modifier = Modifier.testTag("emergency.child-ride.empty"))
                else {
                    Text(contact.name, style = SgmType.BodyLG, color = Sgm.colors.textPrimary)
                    Text(contact.phone, style = SgmType.BodyLG, color = Sgm.colors.textPrimary,
                        modifier = Modifier.testTag("emergency.child-ride.phone"))
                    EmergencyContactButton("Ouvrir le téléphone", "emergency.child-ride.dial", state.canDial, {
                        scope.launch { state.dial { contact ->
                            if (!owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) EmergencyDialerResult.Cancelled
                            else launchDialer?.invoke(contact) ?: openEmergencyDialer(context, contact)
                        } }
                    })
                }
            }
        }
    }
}
