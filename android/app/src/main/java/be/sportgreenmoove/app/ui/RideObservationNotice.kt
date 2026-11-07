package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun RideObservationNotice(state: ActiveRideObservationState) {
    Column(Modifier.padding(20.dp).sgmTestTag("active-ride.observation"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (state.phase == RideObservationPhase.Failed) "Le suivi n’est pas actualisé." else "Actualisation du trajet…",
            style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        if (state.phase == RideObservationPhase.Failed) V2Button("Réessayer", onClick = state::retry, testTag = "active-ride.observation.retry")
    }
}
