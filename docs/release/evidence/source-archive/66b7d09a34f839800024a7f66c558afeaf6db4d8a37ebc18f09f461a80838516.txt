package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.ConversationBookingOption
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.ConversationGateway
import kotlinx.coroutines.launch

@Composable
internal fun ConversationBookingRoute(gateway: ConversationGateway, onBack: () -> Unit, onOpen: (ConversationBookingOption) -> Unit) {
    val state = remember(gateway) { ConversationBookingState(gateway) }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    var refresh by remember { mutableIntStateOf(0) }
    BackHandler(onBack = onBack)
    LaunchedEffect(state, owner, refresh) { owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { state.reload() } }
    Column(Modifier.fillMaxSize().background(Sgm.colors.bgApp).sgmTestTag(SgmTestTags.ChatBookingScreen)) {
        V2TopBar("NOUVEAU MESSAGE", onBack = onBack)
        LazyColumn(Modifier.weight(1f).sgmTestTag(SgmTestTags.ChatBookingList),
            contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when {
                state.loading -> item { MessagesEmptyCard("Chargement...") }
                state.error != null -> item { MessagesEmptyCard(state.error.orEmpty()); V2Button("Réessayer", onClick = { refresh += 1 }) }
                else -> {
                    items(state.items, key = { it.ref.key }) { option -> ConversationBookingCard(option) { onOpen(option) } }
                    if (state.items.isEmpty() && !state.hasEarlier) item { MessagesEmptyCard("Aucune réservation.") }
                    state.earlierError?.let { error -> item { MessagesEmptyCard(error) } }
                    if (state.hasEarlier) item {
                        TextButton(onClick = { scope.launch { state.loadEarlier() } }, enabled = !state.loadingEarlier,
                            modifier = Modifier.sgmTestTag(SgmTestTags.ChatBookingEarlierAction)) {
                            Text(if (state.loadingEarlier) "Chargement..." else "Réservations précédentes")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationBookingCard(option: ConversationBookingOption, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().sgmTestTag("${SgmTestTags.ChatBookingOptionAction}.${option.ref.sourceId}")
        .clip(RoundedCornerShape(14.dp)).background(Sgm.colors.bgCard)
        .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(option.title, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary), maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(option.dateLabel, style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        option.peerLabel?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
        option.childLabel?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
        Text(option.status.label, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary))
    }
}
