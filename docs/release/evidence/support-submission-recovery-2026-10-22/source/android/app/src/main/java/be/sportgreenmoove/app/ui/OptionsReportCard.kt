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
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.FirebaseGateway
import be.sportgreenmoove.app.services.FileSupportSubmissionStore
import java.io.File
import kotlinx.coroutines.launch

@Composable
fun OptionsReportCard(uid: String, firebase: FirebaseGateway) {
    val context = LocalContext.current
    val state = remember(uid, firebase) { SupportSubmissionState(uid,
        FileSupportSubmissionStore(File(context.noBackupFilesDir, "pending-support")), firebase::createReport) }
    DisposableEffect(state) { onDispose { state.close() } }
    SupportSubmissionCard(state)
}

@Composable
internal fun SupportSubmissionCard(state: SupportSubmissionState) {
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .background(Sgm.colors.bgSurface, RoundedCornerShape(SgmRadius.LG))
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("SIGNALER AU SUPPORT", style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp))
        OptionsReportInput("Raison", state.reason, state::reason, state.editable, singleLine = true, testTag = SgmTestTags.SupportReportReasonInput)
        OptionsReportInput("Description", state.description, state::description, state.editable, singleLine = false, testTag = SgmTestTags.SupportReportDescriptionInput)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Urgent", modifier = Modifier.weight(1f), style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
            Switch(checked = state.emergency, onCheckedChange = state::emergency, enabled = state.editable,
                colors = SwitchDefaults.colors(checkedThumbColor = SgmColor.TextOnGreen, checkedTrackColor = SgmColor.GreenDark,
                    uncheckedThumbColor = Sgm.colors.textSecondary, uncheckedTrackColor = Sgm.colors.bgInput,
                    uncheckedBorderColor = Sgm.colors.borderStrong, disabledCheckedThumbColor = SgmColor.TextOnGreen,
                    disabledCheckedTrackColor = SgmColor.GreenDark.copy(alpha = 0.6f)),
                modifier = Modifier.sgmTestTag("support.urgent"))
        }
        V2Button(if (state.busy) "ENVOI..." else if (state.pending != null || !state.ready) "RÉESSAYER" else "ENVOYER",
            onClick = { if (!state.ready) state.restore() else scope.launch { state.submit() } }, enabled = !state.busy,
            full = true, testTag = SgmTestTags.SupportReportAction)
        state.message?.let {
            Text(it, modifier = Modifier.sgmTestTag("support.submission.message"),
                style = SgmType.BodyXS.copy(color = Sgm.colors.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold))
        }
    }
}

@Composable
private fun OptionsReportInput(label: String, value: String, onValue: (String) -> Unit, enabled: Boolean, singleLine: Boolean, testTag: String) {
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
            enabled = enabled,
            textStyle = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium),
            singleLine = singleLine,
            modifier = Modifier.fillMaxWidth().sgmTestTag(testTag),
        )
    }
}
