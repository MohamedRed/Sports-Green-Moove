package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.saveable.SaveableStateHolder
import be.sportgreenmoove.app.data.AuthSession
import be.sportgreenmoove.app.services.AndroidProviderSet

@Composable
internal fun MessagesAppArea(session: AuthSession?, providers: AndroidProviderSet, saved: SaveableStateHolder) {
    session?.uid?.let { uid -> saved.SaveableStateProvider(uid) {
        MessagesScreen(firebase = providers.firebase, conversations = providers.conversations, userId = uid,
            teamConversations = providers.teamConversations, teamUserId = uid.takeIf { canManageTeamEnrollment(session.roles) })
    } }
}
