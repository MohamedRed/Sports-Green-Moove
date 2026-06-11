package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.SgmColors
import be.sportgreenmoove.app.design.SgmSpacing

@Composable
fun SegmentedTabs(options: List<String>, selected: String, onSelected: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Card)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { option ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(42.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(if (selected == option) SgmColors.Surface else Color.Transparent)
                    .clickable { onSelected(option) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option,
                    color = if (selected == option) SgmColors.GreenDark else SgmColors.TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
@Composable
fun SearchBox(placeholder: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(18.dp))
            .padding(horizontal = SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        HeaderCircle("S")
        Text(placeholder, color = SgmColors.TextMuted, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}


@Composable
fun GroupCard(club: String, team: String, members: String, status: String, selected: Boolean) {
    SgmCard(background = if (selected) SgmColors.Card else SgmColors.Surface) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3)) {
            HeaderCircle(club.take(2).uppercase())
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
                Text(club, color = SgmColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("$team · $members", color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Pill(status, selected = selected)
        }
    }
}

@Composable
fun LedgerRow(source: String, detail: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(16.dp))
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(source, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(detail, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(value, color = SgmColors.Green, fontSize = 16.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
fun RoleSelector(current: AppRole, onSelected: (AppRole) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            RolePill(AppRole.Parent, current, onSelected, Modifier.weight(1f))
            RolePill(AppRole.Driver, current, onSelected, Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            RolePill(AppRole.Child, current, onSelected, Modifier.weight(1f))
            RolePill(AppRole.ClubManager, current, onSelected, Modifier.weight(1f))
        }
    }
}

@Composable
fun RolePill(role: AppRole, current: AppRole, onSelected: (AppRole) -> Unit, modifier: Modifier = Modifier) {
    val selected = current == role
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) SgmColors.Green else SgmColors.Card)
            .clickable { onSelected(role) },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            roleLabel(role),
            color = if (selected) SgmColors.Surface else SgmColors.TextSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun ChildRow(name: String, subtitle: String, status: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Avatar(name.take(1), SgmColors.GreenDark)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(name, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(status, color = SgmColors.Green, fontSize = 11.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
    }
}

@Composable
fun MenuRow(title: String, detail: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(SgmColors.Surface)
            .border(BorderStroke(1.dp, SgmColors.Border), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(SgmSpacing.X4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(title, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(detail, color = SgmColors.TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(">", color = SgmColors.Green, fontSize = 18.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
fun FormRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SgmColors.Input)
            .padding(horizontal = SgmSpacing.X3, vertical = SgmSpacing.X3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        Text(value, color = SgmColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
    }
}

@Composable
fun StatusPanel(title: String, body: String, accent: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(accent.copy(alpha = 0.12f))
            .border(BorderStroke(1.dp, accent.copy(alpha = 0.28f)), RoundedCornerShape(18.dp))
            .padding(SgmSpacing.X4),
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HeaderCircle(title.take(1), accent)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Text(title, color = SgmColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(body, color = SgmColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
