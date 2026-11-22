package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.ConversationListItem
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.launch

@Composable
internal fun MessagesInboxRoute(firebase: FirebaseGateway, gateway: ConversationGateway, selected: String,
    onSelected: (String) -> Unit, onNew: () -> Unit, onOpen: (ConversationListItem) -> Unit, teamsEnabled: Boolean = false) {
    val state = remember(firebase, gateway) { MessagesInboxState(firebase, gateway) }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    var refresh by remember { mutableIntStateOf(0) }
    LaunchedEffect(state, owner, refresh) { owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { state.observe() } }
    Column(Modifier.fillMaxSize().background(Sgm.colors.bgApp).sgmTestTag(SgmTestTags.MessagesScreen)) {
        MessagesHeader(onNew)
        MessagesTabs(state.inbox, selected, onSelected, teamsEnabled)
        LazyColumn(Modifier.weight(1f).sgmTestTag(SgmTestTags.ChatInboxList),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (selected == "chats") {
                val directory = state.conversations
                when {
                    directory.loading -> item { MessagesEmptyCard("Chargement...") }
                    directory.error != null -> item {
                        MessagesEmptyCard(directory.error.orEmpty())
                        V2Button("Réessayer", onClick = { refresh += 1 }, testTag = SgmTestTags.ChatInboxRetryAction)
                    }
                    else -> {
                        items(directory.items, key = { it.id }) { chat -> ChatCard(chat) { onOpen(chat) } }
                        if (directory.items.isEmpty() && !directory.hasEarlier) item { MessagesEmptyCard("Aucune conversation.") }
                        directory.earlierError?.let { error -> item { MessagesEmptyCard(error) } }
                        if (directory.hasEarlier) item {
                            TextButton(onClick = { scope.launch { directory.loadEarlier() } }, enabled = !directory.loadingEarlier,
                                modifier = Modifier.sgmTestTag(SgmTestTags.ChatInboxEarlierAction)) {
                                Text(if (directory.loadingEarlier) "Chargement..." else "Conversations précédentes")
                            }
                        }
                    }
                }
            } else when {
                state.loading -> item { MessagesEmptyCard("Chargement...") }
                state.error != null -> item { MessagesEmptyCard(state.error.orEmpty()); V2Button("Réessayer", onClick = { refresh += 1 }) }
                selected == "notifs" -> {
                    if (state.inbox.notifications.isEmpty()) item { MessagesEmptyCard("Aucune notification.") }
                    items(state.inbox.notifications, key = { it.id }) { NotificationCard(it) }
                }
                else -> {
                    state.notice?.let { notice -> item { MessagesEmptyCard(notice) } }
                    if (state.inbox.reviews.isEmpty()) item { MessagesEmptyCard("Aucun avis en attente.") }
                    items(state.inbox.reviews, key = { it.id }) { review ->
                        ReviewCard(review, state.submittingReviewId == review.id) { score ->
                            scope.launch { state.submitReview(review.id, review.rideSessionId, review.ratedUserId, score) }
                        }
                    }
                }
            }
        }
    }
}
