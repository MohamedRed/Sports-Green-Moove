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
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.TripSummary
import be.sportgreenmoove.app.design.SgmColors
import be.sportgreenmoove.app.design.SgmSpacing

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
