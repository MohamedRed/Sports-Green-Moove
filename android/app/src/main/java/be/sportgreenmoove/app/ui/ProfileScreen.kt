package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.ImpactSummary
import be.sportgreenmoove.app.data.RewardSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType
import java.util.Locale

private fun profileSettings(primaryClubLabel: String) = listOf(
    ProfileSetting(SgmIcon.Groups, "Mon club", primaryClubLabel, ProfileAction.Groups),
    ProfileSetting(SgmIcon.Award, "Paiements", "Stripe", ProfileAction.Payments),
    ProfileSetting(SgmIcon.Location, "Ma ville", "Wavre, Belgique", ProfileAction.Options),
    ProfileSetting(SgmIcon.Bell, "Notifications", "Activées", ProfileAction.Options),
    ProfileSetting(SgmIcon.Settings, "Paramètres", "", ProfileAction.Options),
)

@Composable
fun ProfileScreen(
    role: AppRole,
    displayName: String?,
    email: String?,
    primaryClubLabel: String,
    impactSummary: ImpactSummary,
    rewardSummary: RewardSummary,
    onRoleChange: (AppRole) -> Unit,
    onGroups: () -> Unit,
    onImpact: () -> Unit,
    onRewards: () -> Unit,
    onPayments: () -> Unit,
    onOptions: () -> Unit,
    onLogout: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 20.dp),
    ) {
        V2TopBar("MON PROFIL")
        ProfileIdentity(displayName = displayName, email = email, primaryClubLabel = primaryClubLabel)
        ProfileRoleSelector(role = role, onRoleChange = onRoleChange)
        ProfileImpactCard(summary = impactSummary, onClick = onImpact)
        ProfileRewardsCard(summary = rewardSummary, onClick = onRewards)
        V2SectionLabel("PARAMÈTRES")
        ProfileSettingsCard(
            primaryClubLabel = primaryClubLabel,
            onGroups = onGroups,
            onPayments = onPayments,
            onOptions = onOptions,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        Box(Modifier.padding(start = 20.dp, top = 20.dp, end = 20.dp)) {
            V2Button("SE DÉCONNECTER", onClick = onLogout, variant = V2ButtonVariant.Ghost, full = true)
        }
        Spacer(Modifier.height(76.dp))
    }
}

@Composable
private fun ProfileIdentity(displayName: String?, email: String?, primaryClubLabel: String) {
    val name = displayName?.takeIf(String::isNotBlank) ?: email?.substringBefore("@") ?: "Green-Mover"
    val initials = name.split(Regex("\\s+"))
        .filter(String::isNotBlank)
        .take(2)
        .joinToString("") { it.first().uppercaseChar().toString() }
        .ifBlank { "GM" }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .shadow(10.dp, CircleShape, clip = false)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(SgmColor.Green, SgmColor.GreenDark))),
            contentAlignment = Alignment.Center,
        ) {
            Text(initials, style = SgmType.Display2XL.copy(color = SgmColor.TextOnGreen, fontSize = 30.sp, letterSpacing = 0.04.em))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                name.uppercase(Locale.FRANCE),
                style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 22.sp, letterSpacing = 0.06.em),
            )
            Text(
                "$primaryClubLabel${email?.let { " · $it" }.orEmpty()}",
                style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ProfilePill("GREEN-MOOVER", selected = false)
            ProfilePill("U8 NATIONAUX", selected = true)
        }
    }
}

@Composable
private fun ProfileImpactCard(summary: ImpactSummary, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(SgmColor.HeroGradient)
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 18.dp),
    ) {
        SgmGridTexture()
        Column {
            Text(
                "MON IMPACT CO₂",
                style = SgmType.Label.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.50f), fontSize = 11.sp, letterSpacing = 0.14.em),
            )
            Row(
                modifier = Modifier.padding(top = 6.dp),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                Column {
                    Text(kgValue(summary.totalCo2Kg), style = SgmType.Display4XL.copy(color = SgmColor.Green, fontSize = 56.sp))
                    Text(
                        "kg CO₂ économisés",
                        style = SgmType.BodySM.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.60f), fontWeight = FontWeight.SemiBold),
                    )
                }
                Column(
                    modifier = Modifier.padding(bottom = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("${summary.sharedDistanceKm} km partagés", style = ProfileImpactMetaStyle())
                    Text("${summary.rideCount} trajets clôturés", style = ProfileImpactMetaStyle())
                }
            }
        }
    }
}

@Composable
private fun ProfileRewardsCard(summary: RewardSummary, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .padding(start = 20.dp, top = 16.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SgmLineIcon(icon = SgmIcon.Award, tint = SgmColor.Orange, modifier = Modifier.size(22.dp))
            Text(
                "RÉCOMPENSES",
                style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 18.sp, letterSpacing = 0.06.em),
                modifier = Modifier
                    .padding(start = 8.dp)
                    .weight(1f),
            )
            Text(moneyLabel(summary.balanceCents), style = SgmType.DisplayXL.copy(color = SgmColor.Orange, fontSize = 24.sp))
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Sgm.colors.border),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(summary.progress.coerceIn(0f, 1f))
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Brush.horizontalGradient(listOf(SgmColor.Green, SgmColor.Orange))),
            )
        }
        Row {
            Text("Prochain palier à ${moneyLabel(summary.nextTierCents)}", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium), modifier = Modifier.weight(1f))
            Text(percentLabel(summary.progress), style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
        }
    }
}

@Composable
private fun ProfileSettingsCard(
    primaryClubLabel: String,
    onGroups: () -> Unit,
    onPayments: () -> Unit,
    onOptions: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val rows = profileSettings(primaryClubLabel)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)),
    ) {
        rows.forEachIndexed { index, setting ->
            ProfileSettingRow(
                setting = setting,
                showDivider = index < rows.lastIndex,
                onClick = when (setting.action) {
                    ProfileAction.Groups -> onGroups
                    ProfileAction.Payments -> onPayments
                    ProfileAction.Options -> onOptions
                },
            )
        }
    }
}

@Composable
private fun ProfileSettingRow(setting: ProfileSetting, showDivider: Boolean, onClick: () -> Unit) {
    Column(modifier = Modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SgmLineIcon(icon = setting.icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(18.dp))
            Text(setting.label, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
            if (setting.value.isNotEmpty()) {
                Text(setting.value, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 13.sp, fontWeight = FontWeight.Medium))
            }
            SgmLineIcon(icon = SgmIcon.ChevronRight, tint = Sgm.colors.textMuted, modifier = Modifier.size(16.dp))
        }
        if (showDivider) Box(Modifier.padding(start = 46.dp).fillMaxWidth().height(1.dp).background(Sgm.colors.border))
    }
}

@Composable
private fun ProfilePill(text: String, selected: Boolean) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) SgmColor.Green else Sgm.colors.bgCard)
            .then(if (selected) Modifier else Modifier.border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp)))
            .padding(horizontal = 12.dp, vertical = 3.dp),
    ) {
        Text(text, style = SgmType.Label.copy(color = if (selected) SgmColor.TextOnGreen else SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.04.em))
    }
}

private fun ProfileImpactMetaStyle() = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.70f), fontSize = 12.sp)
private fun kgValue(value: Double): String = String.format(Locale.FRANCE, "%.1f", value)
private fun moneyLabel(cents: Int): String {
    val sign = if (cents < 0) "-" else ""
    val abs = kotlin.math.abs(cents)
    return String.format(Locale.FRANCE, "%s%d,%02d€", sign, abs / 100, abs % 100)
}
private fun percentLabel(progress: Float): String = "${(progress.coerceIn(0f, 1f) * 100).toInt()}%"
private data class ProfileSetting(val icon: SgmIcon, val label: String, val value: String, val action: ProfileAction)
private enum class ProfileAction { Groups, Payments, Options }
