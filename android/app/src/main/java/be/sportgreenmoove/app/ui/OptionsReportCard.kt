package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.launch

@Composable
fun OptionsReportCard(firebase: FirebaseGateway) {
    val scope = rememberCoroutineScope()
    var reason by remember { mutableStateOf("Sécurité") }
    var description by remember { mutableStateOf("") }
    var emergency by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    fun submit() {
        if (submitting) return
        if (reason.trim().length < 2 || description.trim().length < 5) {
            message = "Ajoutez une raison et une description précise."
            return
        }
        scope.launch {
            submitting = true
            message = null
            runCatching {
                firebase.createReport(
                    subjectType = "other",
                    subjectId = null,
                    reason = reason.trim(),
                    description = description.trim(),
                    emergency = emergency,
                )
            }.onSuccess { reportId ->
                description = ""
                message = "Signalement envoyé: $reportId"
            }.onFailure { error ->
                message = error.message ?: "Signalement impossible."
            }
            submitting = false
        }
    }

    Column(
        modifier = Modifier
            .padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .sgmTestTag(SgmTestTags.SupportReportAction)
            .background(Sgm.colors.bgSurface, RoundedCornerShape(SgmRadius.LG))
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("SIGNALER AU SUPPORT", style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp))
        OptionsReportInput("Raison", reason, { reason = it }, singleLine = true)
        OptionsReportInput("Description", description, { description = it }, singleLine = false)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            V2Chip("Urgent", selected = emergency, onClick = { emergency = !emergency }, modifier = Modifier.weight(1f))
            V2Chip("Support", selected = true, modifier = Modifier.weight(1f))
        }
        V2Button(if (submitting) "ENVOI..." else "ENVOYER", onClick = ::submit, full = true, testTag = SgmTestTags.SupportReportAction)
        message?.let {
            Text(it, style = SgmType.BodyXS.copy(color = if (it.startsWith("Signalement")) SgmColor.Green else SgmColor.Orange, fontSize = 12.sp, fontWeight = FontWeight.Bold))
        }
    }
}

@Composable
private fun OptionsReportInput(label: String, value: String, onValue: (String) -> Unit, singleLine: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = if (singleLine) 46.dp else 92.dp)
            .background(Sgm.colors.bgInput, RoundedCornerShape(SgmRadius.MD))
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.MD))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        if (value.isEmpty()) Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium))
        BasicTextField(
            value = value,
            onValueChange = onValue,
            textStyle = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium),
            singleLine = singleLine,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
