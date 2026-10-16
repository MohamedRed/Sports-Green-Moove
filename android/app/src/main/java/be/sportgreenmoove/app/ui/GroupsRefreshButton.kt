package be.sportgreenmoove.app.ui

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun GroupsRefreshButton(loading: Boolean, onRefresh: () -> Unit) {
    TooltipBox(positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { PlainTooltip { Text("Actualiser") } }, state = rememberTooltipState()) {
        V2CircleIconButton(SgmIcon.Refresh, onRefresh, size = 44, enabled = !loading,
            testTag = SgmTestTags.GroupsRefreshAction, description = "Actualiser les clubs")
    }
}
