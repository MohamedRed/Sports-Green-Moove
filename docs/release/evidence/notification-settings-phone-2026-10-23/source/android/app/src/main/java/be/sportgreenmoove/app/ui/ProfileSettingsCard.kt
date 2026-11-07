package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
internal fun ProfileSettingsCard(primaryClubLabel: String, onGroups: () -> Unit, onPayments: () -> Unit,
    onOptions: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgSurface)
        .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))) {
        ProfileSettingRow(SgmIcon.Groups, "Mon club", primaryClubLabel, onGroups)
        ProfileSettingRow(SgmIcon.Award, "Paiements", "Stripe", onPayments)
        ProfileSettingRow(SgmIcon.Location, "Ma ville", "Wavre, Belgique", onOptions)
        NotificationSettingsRow(showDivider = true)
        ProfileSettingRow(SgmIcon.Settings, "Paramètres", "", onOptions, showDivider = false)
    }
}

@Composable
private fun ProfileSettingRow(icon: SgmIcon, label: String, value: String, onClick: () -> Unit, showDivider: Boolean = true) {
    Column(Modifier.clickable(onClick = onClick)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SgmLineIcon(icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(18.dp))
            Text(label, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
            if (value.isNotEmpty()) Text(value, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium))
            SgmLineIcon(SgmIcon.ChevronRight, tint = Sgm.colors.textMuted, modifier = Modifier.size(16.dp))
        }
        if (showDivider) Box(Modifier.padding(start = 46.dp).fillMaxWidth().height(1.dp).background(Sgm.colors.border))
    }
}
