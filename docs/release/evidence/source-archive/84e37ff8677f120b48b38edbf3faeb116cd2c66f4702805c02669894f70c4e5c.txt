package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.ConversationMessage
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun ConversationBubble(message: ConversationMessage) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        horizontalArrangement = if (message.mine) Arrangement.End else Arrangement.Start) {
        Column(Modifier.widthIn(max = 320.dp).fillMaxWidth(0.88f).clip(RoundedCornerShape(12.dp))
            .background(if (message.mine) Sgm.colors.bgSurface else Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(12.dp)).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val author = if (message.mine) "Vous" else message.authorName
            author?.let { Text(it, style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 11.sp)) }
            Text(message.body, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp))
            Text(DateTimeFormatter.ofPattern("dd MMM · HH:mm", Locale.FRENCH)
                .withZone(ZoneId.systemDefault()).format(Instant.ofEpochSecond(message.createdAtSeconds, message.createdAtNanos.toLong())),
                style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 11.sp), modifier = Modifier.align(Alignment.End))
        }
    }
}

@Composable
internal fun ConversationComposer(
    draft: String, onDraft: (String) -> Unit, locked: Boolean, sending: Boolean,
    enabled: Boolean, error: String?, onSend: () -> Unit,
) {
    val validLength = draft.trim().length <= 1000
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (sending || error != null || !validLength) Text(
            when { !validLength -> "Maximum 1 000 caractères."; sending -> "Envoi en cours..."; else -> error.orEmpty() },
            style = SgmType.BodyXS.copy(color = SgmColor.Orange, fontSize = 12.sp),
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BasicTextField(value = draft, onValueChange = onDraft, readOnly = locked || sending, enabled = enabled,
                textStyle = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp), maxLines = 4,
                modifier = Modifier.weight(1f).heightIn(min = 48.dp, max = 120.dp)
                    .sgmTestTag(SgmTestTags.ChatMessageInput).semantics { contentDescription = "Votre message" }
                    .clip(RoundedCornerShape(12.dp)).background(Sgm.colors.bgInput)
                    .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(12.dp)).padding(14.dp),
                decorationBox = { field ->
                    if (draft.isEmpty()) Text("Votre message", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 14.sp))
                    field()
                },
            )
            FilledIconButton(onClick = onSend, enabled = enabled && !sending && validLength && draft.isNotBlank(),
                modifier = Modifier.size(48.dp).sgmTestTag(SgmTestTags.ChatSendAction).semantics {
                    contentDescription = if (locked && error != null) "Réessayer l'envoi" else "Envoyer le message"
                }, colors = IconButtonDefaults.filledIconButtonColors(containerColor = SgmColor.Green,
                    contentColor = SgmColor.TextOnAccent, disabledContainerColor = Sgm.colors.bgElevated,
                    disabledContentColor = Sgm.colors.textSecondary)) {
                SgmLineIcon(SgmIcon.ArrowRight, tint = if (enabled && !sending && validLength && draft.isNotBlank())
                    SgmColor.TextOnAccent else Sgm.colors.textSecondary, modifier = Modifier.size(20.dp))
            }
        }
    }
}
