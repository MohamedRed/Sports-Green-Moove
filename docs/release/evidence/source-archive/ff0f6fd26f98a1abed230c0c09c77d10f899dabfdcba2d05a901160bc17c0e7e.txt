package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun TeamConversationDraftScreen(error: String?, onRetry: () -> Unit, onBack: () -> Unit) {
    V2Screen(testTag = "team-chat.draft-state") {
        V2TopBar("ÉQUIPE", onBack)
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (error == null) CircularProgressIndicator(color = Sgm.colors.textPrimary)
            else {
                Text(error, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
                V2Button("Réessayer", onRetry, testTag = "team-chat.draft-retry")
            }
        }
    }
}
