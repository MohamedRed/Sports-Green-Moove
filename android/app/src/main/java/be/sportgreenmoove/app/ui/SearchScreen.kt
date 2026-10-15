package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.data.PlaceSuggestion
import be.sportgreenmoove.app.data.ResolvedPlace
import be.sportgreenmoove.app.data.TripMatchSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun SearchScreen(
    originInput: String,
    destinationInput: String,
    form: SearchFormState,
    origin: ResolvedPlace?,
    destination: ResolvedPlace?,
    originSuggestions: List<PlaceSuggestion>,
    destinationSuggestions: List<PlaceSuggestion>,
    children: List<ChildSummary>,
    matches: List<TripMatchSummary>,
    loading: Boolean,
    error: String?,
    onBack: () -> Unit,
    onSuggestOrigin: (String) -> Unit,
    onSuggestDestination: (String) -> Unit,
    onSelectOrigin: (PlaceSuggestion) -> Unit,
    onSelectDestination: (PlaceSuggestion) -> Unit,
    onSearch: () -> Unit,
    onRequest: (TripMatchSummary) -> Unit,
    onOriginChanged: (String) -> Unit,
    onDestinationChanged: (String) -> Unit,
    onFormChange: (SearchFormState) -> Unit,
    hasSearched: Boolean = false,
) {
    V2Screen(testTag = SgmTestTags.SearchScreen) {
        V2TopBar("RECHERCHE", onBack = onBack)
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PlaceSearchField("Départ", originInput, origin, originSuggestions, onOriginChanged,
                onSuggestOrigin, onSelectOrigin, SgmTestTags.SearchOriginInput)
            PlaceSearchField("Destination", destinationInput, destination, destinationSuggestions, onDestinationChanged,
                onSuggestDestination, onSelectDestination, SgmTestTags.SearchDestinationInput)
            SearchInput("Date et heure de départ", form.desiredDepartureAtIso,
                { onFormChange(form.copy(desiredDepartureAtIso = it)) }, testTag = SgmTestTags.SearchDateInput)
            SearchChildSelector(
                children = children,
                selectedChildId = form.childUserId,
                onSelectedChild = { onFormChange(form.copy(childUserId = it, guardianConsent = false)) },
            )
            if (form.requireChildTracking) {
                ChildTrackingReleaseDisclosures()
            }
            SearchOptions(
                seatsNeeded = form.seatsNeeded,
                onSeats = { onFormChange(form.copy(seatsNeeded = it)) },
                baggage = form.baggage,
                onBaggage = { onFormChange(form.copy(baggage = it)) },
                returnTrip = form.returnTrip,
                onReturnTrip = { onFormChange(form.copy(returnTrip = it)) },
                childTracking = form.requireChildTracking,
                onChildTracking = { onFormChange(form.copy(requireChildTracking = it, guardianConsent = false)) },
                guardianConsent = form.guardianConsent,
                onGuardianConsent = { onFormChange(form.copy(guardianConsent = it)) },
            )
            if (error != null) Text(error, style = SgmType.BodyXS.copy(color = SgmColor.Orange, fontWeight = FontWeight.Bold))
            V2Button(
                if (loading) "RECHERCHE EN COURS" else "TROUVER UN TRAJET",
                onClick = onSearch,
                full = true,
                size = V2ButtonSize.Lg,
                testTag = SgmTestTags.SearchAction,
            )
        }

        V2SectionLabel("${matches.size} MATCH${if (matches.size > 1) "S" else ""}")
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            matches.forEach { match -> MatchCard(match = match, onRequest = { onRequest(match) }) }
            if (!loading && matches.isEmpty()) {
                EmptyMatchCard(hasSearched)
            }
        }
    }
}

@Composable
private fun SearchOptions(
    seatsNeeded: Int,
    onSeats: (Int) -> Unit,
    baggage: String,
    onBaggage: (String) -> Unit,
    returnTrip: Boolean,
    onReturnTrip: (Boolean) -> Unit,
    childTracking: Boolean,
    onChildTracking: (Boolean) -> Unit,
    guardianConsent: Boolean,
    onGuardianConsent: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf(1, 2, 3).forEach { seats -> V2Chip("$seats place${if (seats > 1) "s" else ""}", seatsNeeded == seats, { onSeats(seats) }, Modifier.weight(1f)) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("small" to "Petit", "medium" to "Moyen", "large" to "Grand").forEach { (value, label) -> V2Chip(label, baggage == value, { onBaggage(value) }, Modifier.weight(1f)) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            V2Chip("Retour", returnTrip, { onReturnTrip(!returnTrip) }, Modifier.weight(1f))
            V2Chip("Suivi enfant", childTracking, { onChildTracking(!childTracking) }, Modifier.weight(1f))
            V2Chip("Consentement", guardianConsent, { onGuardianConsent(!guardianConsent) }, Modifier.weight(1f))
        }
    }
}

@Composable
private fun MatchCard(match: TripMatchSummary, onRequest: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(match.summary.sport.uppercase(), style = SgmType.Eyebrow.copy(color = SgmColor.Green, fontSize = 11.sp, letterSpacing = 0.14.em), modifier = Modifier.weight(1f))
            Text(match.summary.departureLabel, style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold))
        }
        Text(match.summary.title, style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 17.sp, letterSpacing = 0.03.em), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(match.summary.seatsLabel, style = SearchMetaStyle())
            Text(match.summary.priceLabel, style = SearchMetaStyle())
            match.detourMinutes?.let { Text("+$it min détour", style = SearchMetaStyle()) }
            Spacer(Modifier.weight(1f))
            V2Button("Demander", onClick = onRequest, size = V2ButtonSize.Sm, testTag = SgmTestTags.BookingRequestAction)
        }
        Text(match.reasons.take(3).joinToString(" · "), style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium), maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun EmptyMatchCard(hasSearched: Boolean) {
    Text(
        if (hasSearched) "Aucun trajet trouvé." else "Choisissez un départ, une destination et lancez la recherche.",
        style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 14.sp),
        modifier = Modifier.padding(vertical = 24.dp),
    )
}

@Composable
private fun SearchMetaStyle() = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
