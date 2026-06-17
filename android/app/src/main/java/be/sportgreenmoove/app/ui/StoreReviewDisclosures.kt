package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun ChildTrackingReleaseDisclosures(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        StoreReviewDisclosureCard(
            icon = SgmIcon.Check,
            title = stringResource(R.string.guardian_consent_title),
            body = stringResource(R.string.child_tracking_guardian_consent),
            testTag = SgmTestTags.GuardianConsentDisclosure,
        )
        StoreReviewDisclosureCard(
            icon = SgmIcon.Profile,
            title = stringResource(R.string.child_safety_disclosure_title),
            body = stringResource(R.string.child_tracking_safety_disclosure),
            testTag = SgmTestTags.ChildSafetyDisclosure,
        )
    }
}

@Composable
fun PrivacyProcessorDisclosure(modifier: Modifier = Modifier) {
    StoreReviewDisclosureCard(
        icon = SgmIcon.Settings,
        title = stringResource(R.string.privacy_policy_summary_title),
        body = stringResource(R.string.privacy_policy_summary),
        testTag = SgmTestTags.PrivacySummaryDisclosure,
        modifier = modifier,
    )
}

@Composable
private fun StoreReviewDisclosureCard(
    icon: SgmIcon,
    title: String,
    body: String,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .sgmTestTag(testTag)
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SgmLineIcon(icon, tint = SgmColor.Green, modifier = Modifier.size(18.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                title,
                style = SgmType.BodySM.copy(
                    color = Sgm.colors.textPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
            Text(
                body,
                style = SgmType.BodyXS.copy(
                    color = Sgm.colors.textMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                ),
            )
        }
    }
}
