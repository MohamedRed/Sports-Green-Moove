package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.data.ConversationKind
import be.sportgreenmoove.app.data.ConversationRef
import be.sportgreenmoove.app.data.ConversationContext
import be.sportgreenmoove.app.services.ConversationGateway
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.TeamConversationGateway

@Composable
fun MessagesScreen(firebase: FirebaseGateway, conversations: ConversationGateway,
    teamConversations: TeamConversationGateway? = null, teamUserId: String? = null) {
    val saved = rememberSaveableStateHolder()
    var selectedType by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var choosingBooking by rememberSaveable { mutableStateOf(false) }
    var selectedTab by rememberSaveable { mutableStateOf("chats") }
    var contextTitle by rememberSaveable { mutableStateOf<String?>(null) }
    var contextTripLabel by rememberSaveable { mutableStateOf<String?>(null) }
    fun open(ref: ConversationRef, title: String, label: String) {
        selectedType = ref.kind.sourceType; selectedId = ref.sourceId
        contextTitle = title; contextTripLabel = label
    }
    val type = selectedType
    val id = selectedId
    when {
        selectedTab == "teams" && teamConversations != null && teamUserId != null ->
            TeamConversationArea(teamUserId, teamConversations) { selectedTab = "chats" }
        type != null && id != null -> {
            val ref = ConversationRef(ConversationKind.fromSource(type), id)
            saved.SaveableStateProvider(ref.key) {
                val title = contextTitle
                val label = contextTripLabel
                val context = if (title != null && label != null) ConversationContext(title, label) else null
                ConversationRoute(ref, conversations, context) {
                    selectedType = null; selectedId = null; choosingBooking = false; selectedTab = "chats"
                }
            }
        }
        choosingBooking -> saved.SaveableStateProvider("booking-picker") {
            ConversationBookingRoute(conversations, onBack = { choosingBooking = false },
                onOpen = { open(it.ref, it.title, it.dateLabel) })
        }
        else -> saved.SaveableStateProvider("inbox") {
            MessagesInboxRoute(firebase, conversations, selectedTab, onSelected = { selectedTab = it },
                onNew = { choosingBooking = true }, onOpen = { open(it.ref, it.title, it.tripLabel) },
                teamsEnabled = teamConversations != null && teamUserId != null)
        }
    }
}
