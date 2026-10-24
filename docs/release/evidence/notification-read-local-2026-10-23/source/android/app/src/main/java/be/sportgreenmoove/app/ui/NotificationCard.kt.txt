package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.InboxNotificationSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NotificationCard(notice: InboxNotificationSummary, busy: Boolean, pending: Boolean,
    error: String?, onRead: () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Sgm.colors.bgCard)
        .padding(14.dp).sgmTestTag("notification.${notice.id}"), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(notice.title, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontWeight = FontWeight.Bold))
                Text(notice.body, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
            }
            if (notice.unread) {
                TooltipBox(positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
                    tooltip = { PlainTooltip { Text("Marquer comme lue") } }, state = rememberTooltipState()) {
                    V2CircleIconButton(SgmIcon.Check, onRead, size = 48, enabled = !busy,
                        testTag = "notification.read.${notice.id}", description = "Marquer comme lue : ${notice.title}")
                }
            }
        }
        Text("${notice.dateLabel} · ${if (pending) "Confirmation..." else if (notice.unread) "Non lue" else "Lue"}",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted), modifier = Modifier.sgmTestTag("notification.status.${notice.id}"))
        error?.let {
            Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary),
                modifier = Modifier.sgmTestTag("notification.error.${notice.id}"))
        }
    }
}
