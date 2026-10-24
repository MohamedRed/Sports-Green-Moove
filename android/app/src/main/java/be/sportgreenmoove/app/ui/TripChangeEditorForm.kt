package be.sportgreenmoove.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.domain.tripChangePriceCents
import be.sportgreenmoove.app.services.FirebaseGateway
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
internal fun TripChangeEditorForm(draft: TripChangeDraft, enabled: Boolean, gateway: FirebaseGateway) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TripChangeDateTime("Départ proposé", "departure", draft.departureDate, draft.departureTime, enabled,
            { draft.departureDate = it }, { draft.departureTime = it })
        Row {
            Checkbox(draft.hasArrival, { draft.hasArrival = it }, enabled = enabled, modifier = Modifier.testTag("trip.change.arrival.enabled"))
            Text("Heure d’arrivée souhaitée", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.padding(top = 12.dp))
        }
        if (draft.hasArrival) TripChangeDateTime("Arrivée proposée", "arrival", draft.arrivalDate, draft.arrivalTime, enabled,
            { draft.arrivalDate = it }, { draft.arrivalTime = it })
        OutlinedTextField(draft.price, { if (enabled && it.length <= 8) draft.price = it }, enabled = enabled,
            label = { Text("Prix par place (EUR)") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            isError = draft.price.isNotBlank() && tripChangePriceCents(draft.price) == null,
            supportingText = { if (tripChangePriceCents(draft.price) == null) Text("De 0 à 1 000 EUR, avec deux décimales maximum.") },
            modifier = Modifier.fillMaxWidth().testTag("trip.change.price"))
        TripChangePlaceEditor("Départ", "origin", draft.origin, enabled, gateway)
        TripChangePlaceEditor("Destination", "destination", draft.destination, enabled, gateway)
        draft.validationMessage(java.time.Instant.now())?.let {
            Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary), modifier = Modifier.testTag("trip.change.validation"))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TripChangeDateTime(
    label: String, tag: String, date: LocalDate, time: LocalTime, enabled: Boolean,
    onDate: (LocalDate) -> Unit, onTime: (LocalTime) -> Unit,
) {
    val context = LocalContext.current
    Column {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { DatePickerDialog(context, { _, year, month, day -> onDate(LocalDate.of(year, month + 1, day)) },
                date.year, date.monthValue - 1, date.dayOfMonth).show() }, enabled = enabled,
                modifier = Modifier.testTag("trip.change.$tag.date")) {
                SgmLineIcon(SgmIcon.Calendar, tint = Sgm.colors.textPrimary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")), color = Sgm.colors.textPrimary)
            }
            TextButton(onClick = { TimePickerDialog(context, { _, hour, minute -> onTime(LocalTime.of(hour, minute)) },
                time.hour, time.minute, true).show() }, enabled = enabled, modifier = Modifier.testTag("trip.change.$tag.time")) {
                Text("${time.format(DateTimeFormatter.ofPattern("HH:mm"))} · Bruxelles", color = Sgm.colors.textPrimary)
            }
        }
    }
}

@Composable
private fun TripChangePlaceEditor(label: String, tag: String, state: TripChangePlaceDraft, enabled: Boolean, gateway: FirebaseGateway) {
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        OutlinedTextField(state.input, { if (enabled) state.edit(it) }, enabled = enabled,
            label = { Text(label) }, placeholder = { Text(if (state.point != null) "Lieu actuel conservé" else "Rechercher une adresse") }, singleLine = false, maxLines = 3,
            trailingIcon = {
                IconButton(onClick = { scope.launch { state.suggest(gateway) } }, enabled = enabled && !state.busy && state.input.isNotBlank(),
                    modifier = Modifier.testTag("trip.change.$tag.search").semantics { contentDescription = "Chercher : $label" }) {
                    SgmLineIcon(SgmIcon.Search, tint = Sgm.colors.textPrimary, modifier = Modifier.size(20.dp))
                }
            }, modifier = Modifier.fillMaxWidth().testTag("trip.change.$tag.input"))
        state.address?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
        state.point?.let { Text("%.6f, %.6f".format(java.util.Locale.ROOT, it.lat, it.lng), style = SgmType.BodyXS.copy(color = Sgm.colors.textSecondary)) }
        state.suggestions.take(5).forEach { suggestion ->
            TextButton(onClick = { scope.launch { state.select(suggestion, gateway) } }, enabled = enabled && !state.busy,
                modifier = Modifier.fillMaxWidth().testTag("trip.change.$tag.suggestion.${suggestion.placeId}")) {
                Text(suggestion.label, color = Sgm.colors.textPrimary)
            }
        }
        if (state.input.isNotEmpty() || state.point == null) TextButton(state::keepOriginal, enabled = enabled,
            modifier = Modifier.testTag("trip.change.$tag.keep")) { Text("Conserver le lieu actuel", color = Sgm.colors.textPrimary) }
        if (state.busy) Text("Recherche en cours...", style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary))
        state.error?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary)) }
    }
}
