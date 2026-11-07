package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.AuthSession

@Composable
internal fun ObserveMobileRoleSelection(session: AuthSession?, role: AppRole, onSelected: suspend (AppRole) -> Unit) {
    var lastUid by remember { mutableStateOf<String?>(null) }
    val select by rememberUpdatedState(onSelected)
    LaunchedEffect(session?.uid, session?.roles) {
        if (session == null) lastUid = null
        else {
            val selected = selectActiveMobileRole(role, session.roles, session.uid != lastUid)
            lastUid = session.uid
            if (selected != role) select(selected)
        }
    }
}
