package be.sportgreenmoove.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmType
import java.time.LocalDate
import java.time.LocalTime

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SearchDepartureField(value: String, onValueChange: (String) -> Unit) {
    val context = LocalContext.current
    val departure = remember(value) { SearchDepartureInput.fromIso(value) }
    var issue by remember(value) { mutableStateOf<String?>(null) }
    fun choose(next: SearchDepartureInput) {
        if (next == departure) { issue = null; return }
        val instant = next.toIso()
        if (instant == null) {
            issue = "Cette heure est absente ou ambiguë lors du changement d’heure. Choisissez une autre heure ; le choix affiché est conservé."
        } else { issue = null; onValueChange(instant) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Date et heure de départ", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        if (departure == null) {
            Text("Date de départ invalide.", style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary))
        } else FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = {
                DatePickerDialog(context, { _, year, month, day -> choose(departure.copy(date = LocalDate.of(year, month + 1, day))) },
                    departure.date.year, departure.date.monthValue - 1, departure.date.dayOfMonth).show()
            }, modifier = Modifier.heightIn(min = 48.dp).sgmTestTag(SgmTestTags.SearchDateInput)
                .semantics { contentDescription = "Date de départ : ${departure.dateLabel}" }) {
                SgmLineIcon(SgmIcon.Calendar, tint = Sgm.colors.textPrimary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(departure.dateLabel, color = Sgm.colors.textPrimary)
            }
            TextButton(onClick = {
                TimePickerDialog(context, { _, hour, minute -> choose(departure.copy(time = LocalTime.of(hour, minute))) },
                    departure.time.hour, departure.time.minute, true).show()
            }, modifier = Modifier.heightIn(min = 48.dp).sgmTestTag(SgmTestTags.SearchTimeInput)
                .semantics { contentDescription = "Heure de départ : ${departure.timeLabel}" }) {
                Text(departure.timeLabel, color = Sgm.colors.textPrimary)
            }
        }
        issue?.let { Text(it, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary),
            modifier = Modifier.sgmTestTag("search.departure.issue")) }
    }
}
