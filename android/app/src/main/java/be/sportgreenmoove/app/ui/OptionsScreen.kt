package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

private val OptionSections = listOf(
    OptionSection(
        "SÉCURITÉ",
        listOf(
            OptionRow(SgmIcon.Profile, "Contact urgence", "+32 470 00 00 00", "Action visible pendant une course active"),
            OptionRow(SgmIcon.Check, "Journal d'audit", "Activé", "Pickup, dropoff, consentements et paiements"),
            OptionRow(SgmIcon.Groups, "Consentement parent", "Obligatoire", "Chaque enfant reste lié à son tuteur"),
        ),
    ),
    OptionSection(
        "LOCALISATION",
        listOf(
            OptionRow(SgmIcon.Location, "Arrière-plan", "Trajets actifs", "Suivi arrêté hors session de course"),
            OptionRow(SgmIcon.Search, "Alertes position", "Activées", "Dernière mise à jour et statut obsolète"),
            OptionRow(SgmIcon.Bell, "Notifications", "Activées", "Départ, pickup, dropoff et retard"),
        ),
    ),
    OptionSection(
        "PAIEMENTS",
        listOf(
            OptionRow(SgmIcon.Award, "Carte", "Stripe PaymentSheet", "Autorisation avant validation conducteur"),
            OptionRow(SgmIcon.ArrowRight, "Payout", "Stripe Connect", "Versements visibles dans le ledger"),
            OptionRow(SgmIcon.Settings, "Frais plateforme", "0 EUR", "En attente des conditions business"),
        ),
    ),
)

@Suppress("UNUSED_PARAMETER")
@Composable
fun OptionsScreen(onBack: () -> Unit) {
    V2Screen {
        V2TopBar("OPTIONS")
        OptionHero()
        OptionSections.forEach { section ->
            V2SectionLabel(section.title)
            OptionSectionCard(section.rows)
        }
        Box(Modifier.height(76.dp))
    }
}

@Composable
private fun OptionHero() {
    Column(
        modifier = Modifier
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(20.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("CONTRÔLES DU COMPTE", style = SgmType.Eyebrow.copy(color = SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.14.em))
        Text("Sécurité, localisation et paiements", style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 20.sp, letterSpacing = 0.04.em))
        Text(
            "Les réglages sensibles restent liés aux courses actives et aux consentements tuteur.",
            style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium),
        )
    }
}

@Composable
private fun OptionSectionCard(rows: List<OptionRow>) {
    Column(
        modifier = Modifier
            .padding(start = 20.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG)),
    ) {
        rows.forEachIndexed { index, row ->
            OptionRowView(row, showDivider = index < rows.lastIndex)
        }
    }
}

@Composable
private fun OptionRowView(row: OptionRow, showDivider: Boolean) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SgmLineIcon(row.icon, tint = Sgm.colors.textMuted, modifier = Modifier.size(18.dp))
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(row.label, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
                    Text(row.value, style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.Bold))
                }
                Text(row.detail, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
            }
        }
        if (showDivider) Box(Modifier.padding(start = 46.dp).fillMaxWidth().height(1.dp).background(Sgm.colors.border))
    }
}

private data class OptionSection(val title: String, val rows: List<OptionRow>)
private data class OptionRow(val icon: SgmIcon, val label: String, val value: String, val detail: String)
