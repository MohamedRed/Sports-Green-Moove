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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.TripPublishDraft
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.services.FirebaseGateway
import java.time.Instant
import java.time.temporal.ChronoUnit

private val PublishCats = listOf("U 5/6", "U 7/8", "U 9/10", "U 11/12", "U 13/14", "U 15/16", "Seniors", "Réserves")
private val PublishFreqs = listOf("UNIQUE", "CHAQUE LUN", "CHAQUE MAR", "CHAQUE MER", "CHAQUE JEU", "CHAQUE VEN", "CHAQUE SAM", "CHAQUE DIM")

@Composable
fun PublishScreen(
    role: AppRole,
    firebase: FirebaseGateway,
    onError: (String?) -> Unit,
    onNotice: (String) -> Unit,
    onPublished: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val controller = rememberPublishController(firebase, scope, onError, onNotice, onPublished)
    var step by remember { mutableStateOf(1) }
    var from by remember { mutableStateOf(controller.origin?.label.orEmpty()) }
    var to by remember { mutableStateOf(controller.destination?.label.orEmpty()) }
    var category by remember { mutableStateOf("U 7/8") }
    var returnTrip by remember { mutableStateOf(true) }
    var seats by remember { mutableStateOf(2) }
    var frequency by remember { mutableStateOf("UNIQUE") }
    var price by remember { mutableStateOf("") }
    var departureIso by remember { mutableStateOf(Instant.now().plus(30, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES).toString()) }
    var childTracking by remember { mutableStateOf(true) }

    V2Screen {
        V2TopBar("PUBLIER UN TRAJET", onBack = if (step > 1) ({ step -= 1 }) else null)
        PublishStepIndicator(step)
        Column(modifier = Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (role != AppRole.Driver) {
                PublishDriverRequired()
            } else when (step) {
                1 -> PublishStepOne(
                    from = from,
                    onFrom = { from = it },
                    to = to,
                    onTo = { to = it },
                    controller = controller,
                    onNext = {
                        if (controller.origin == null || controller.destination == null) {
                            onError("Choisissez un départ et une destination dans les suggestions.")
                        } else {
                            step = 2
                        }
                    },
                )
                2 -> PublishStepTwo(
                    category = category,
                    onCategory = { category = it },
                    returnTrip = returnTrip,
                    onReturnTrip = { returnTrip = !returnTrip },
                    seats = seats,
                    onSeats = { seats = it.coerceIn(1, 6) },
                    frequency = frequency,
                    onFrequency = { frequency = it },
                    price = price,
                    onPrice = { price = it },
                    departureIso = departureIso,
                    onDepartureIso = { departureIso = it },
                    childTracking = childTracking,
                    onChildTracking = { childTracking = !childTracking },
                    onNext = { step = 3 },
                )

                else -> PublishStepThree(
                    from = controller.origin?.formattedAddress ?: from,
                    to = controller.destination?.formattedAddress ?: to,
                    seats = seats,
                    frequency = frequency,
                    returnTrip = returnTrip,
                    price = price,
                    category = category,
                    loading = controller.loading,
                    onPublish = {
                        controller.publish(
                            publishDraft(
                                category = category,
                                departureIso = departureIso,
                                origin = controller.origin,
                                destination = controller.destination,
                                seats = seats,
                                price = price,
                                returnTrip = returnTrip,
                                childTracking = childTracking,
                            ),
                        )
                    },
                )
            }
        }
    }
}

@Composable
private fun PublishStepIndicator(step: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 6.dp, end = 20.dp, bottom = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        (1..3).forEach { index ->
            PublishStepDot(index, active = step >= index)
            if (index < 3) Box(Modifier.weight(1f).height(2.dp).clip(RoundedCornerShape(999.dp)).background(if (step > index) SgmColor.Green else Sgm.colors.border))
        }
    }
}

@Composable
private fun PublishStepOne(
    from: String,
    onFrom: (String) -> Unit,
    to: String,
    onTo: (String) -> Unit,
    controller: PublishController,
    onNext: () -> Unit,
) {
    PublishTitle("DÉPART & DESTINATION")
    PublishPlaceField(
        label = "Adresse de départ",
        icon = SgmIcon.Location,
        value = from,
        selected = controller.origin,
        suggestions = controller.originSuggestions,
        onValueChange = onFrom,
        onSuggest = { controller.suggestPlaces(it, SearchPlaceTarget.Origin) },
        onSelect = { suggestion -> controller.selectPlace(suggestion, SearchPlaceTarget.Origin) },
    )
    PublishPlaceField(
        label = "Adresse de destination",
        icon = SgmIcon.Flag,
        value = to,
        selected = controller.destination,
        suggestions = controller.destinationSuggestions,
        onValueChange = onTo,
        onSuggest = { controller.suggestPlaces(it, SearchPlaceTarget.Destination) },
        onSelect = { suggestion -> controller.selectPlace(suggestion, SearchPlaceTarget.Destination) },
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(110.dp)
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(SgmColor.HeroGradient),
        contentAlignment = Alignment.Center,
    ) {
        SgmGridTexture()
        Text("GREEN SMARTMAP", style = SgmType.Eyebrow.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.40f), fontSize = 14.sp, letterSpacing = 0.12.em))
    }
    V2Button("SUIVANT →", onClick = onNext, full = true, size = V2ButtonSize.Lg)
}

@Composable
private fun PublishStepTwo(
    category: String,
    onCategory: (String) -> Unit,
    returnTrip: Boolean,
    onReturnTrip: () -> Unit,
    seats: Int,
    onSeats: (Int) -> Unit,
    frequency: String,
    onFrequency: (String) -> Unit,
    price: String,
    onPrice: (String) -> Unit,
    departureIso: String,
    onDepartureIso: (String) -> Unit,
    childTracking: Boolean,
    onChildTracking: () -> Unit,
    onNext: () -> Unit,
) {
    PublishTitle("DÉTAILS DU TRAJET")
    PublishChoiceRow("Catégorie", PublishCats, category, onCategory)
    PublishInput(SgmIcon.Calendar, "Date ISO", departureIso, onDepartureIso)
    PublishToggleRow("Aller - retour", returnTrip, onReturnTrip)
    PublishToggleRow("Suivi enfant", childTracking, onChildTracking)
    PublishSeatsRow(seats, onSeats)
    PublishChoiceRow("Fréquence", PublishFreqs, frequency, onFrequency, titleFirst = true)
    PublishPriceRow(price, onPrice)
    V2Button("SUIVANT →", onClick = onNext, full = true, size = V2ButtonSize.Lg)
}

@Composable
private fun PublishStepThree(from: String, to: String, seats: Int, frequency: String, returnTrip: Boolean, price: String, category: String, loading: Boolean, onPublish: () -> Unit) {
    PublishTitle("CONFIRMER")
    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(SgmRadius.LG)).background(Sgm.colors.bgCard).border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))) {
        Box(Modifier.fillMaxWidth().background(SgmColor.HeroGradient).padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text("FOOTBALL · $category", style = SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen, fontSize = 18.sp, letterSpacing = 0.04.em))
        }
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Départ" to (from.ifBlank { "—" }), "Destination" to (to.ifBlank { "—" }), "Places" to seats.toString(), "Fréquence" to frequency, "Aller-retour" to if (returnTrip) "Oui" else "Non", "Prix" to (if (price.isNotBlank()) "$price€" else "Gratuit")).forEach { (label, value) ->
                PublishSummaryRow(label, value)
            }
        }
    }
    V2Button(if (loading) "PUBLICATION..." else "PUBLIER CE TRAJET", onClick = onPublish, full = true, size = V2ButtonSize.Lg)
}

private fun publishDraft(
    category: String,
    departureIso: String,
    origin: be.sportgreenmoove.app.data.ResolvedPlace?,
    destination: be.sportgreenmoove.app.data.ResolvedPlace?,
    seats: Int,
    price: String,
    returnTrip: Boolean,
    childTracking: Boolean,
): TripPublishDraft? {
    if (origin == null || destination == null) return null
    return TripPublishDraft(
        title = "U8 Nationaux vs Royal Ottignies SC",
        sport = "Football",
        clubName = "Royal Ottignies",
        teamName = category,
        clubId = "royal-ottignies",
        teamId = category.lowercase().replace(" ", "-"),
        category = category,
        departureAtIso = departureIso,
        origin = origin,
        destination = destination,
        pickupRadiusM = 1500,
        seatsTotal = seats,
        seatsAvailable = seats,
        baggage = "medium",
        returnTrip = returnTrip,
        priceCents = parsePriceCents(price),
        supportsVehicleTracking = true,
        supportsChildTracking = childTracking,
        co2SavedKgEstimate = 4.2,
    )
}

private fun parsePriceCents(value: String): Int {
    val amount = value.replace(",", ".").trim().toDoubleOrNull() ?: 0.0
    return (amount * 100).toInt().coerceAtLeast(0)
}
