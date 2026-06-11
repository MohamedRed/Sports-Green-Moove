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
fun ScreenFrame(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = SgmSpacing.X4, vertical = SgmSpacing.X4)
            .padding(bottom = SgmSpacing.X6),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        content = content,
    )
}

@Composable
fun TopBrandBar(
    title: String,
    subtitle: String,
    trailing: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
            Wordmark()
            Text(title, color = SgmColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        trailing()
    }
}

@Composable
fun BackHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(SgmColors.Surface)
                .border(BorderStroke(1.dp, SgmColors.Border), CircleShape)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Text("<", color = SgmColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(SgmSpacing.X1)) {
            Wordmark()
            Text(title, color = SgmColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = SgmColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun Wordmark(large: Boolean = false) {
    val base = if (large) 17.sp else 13.sp
    val mid = if (large) 21.sp else 18.sp
    val oo = if (large) 32.sp else 27.sp
    Row(verticalAlignment = Alignment.Bottom) {
        Text("SPORTS ", color = SgmColors.TextMuted, fontSize = base, fontWeight = FontWeight.Black)
        Text("GREEN-", color = SgmColors.Green, fontSize = base, fontWeight = FontWeight.Black)
        Text("m", color = SgmColors.TextPrimary, fontSize = mid, fontWeight = FontWeight.Black)
        Text("OO", color = SgmColors.Green, fontSize = oo, fontWeight = FontWeight.Black)
        Text("Ve", color = SgmColors.TextPrimary, fontSize = mid, fontWeight = FontWeight.Black)
    }
}

@Composable
fun HeroCard(
    kicker: String,
    title: String,
    detail: String,
    primary: String,
    secondary: String,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(SgmColors.GreenDark),
    ) {
        GridAccent(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(SgmSpacing.X4),
        )
        Column(
            modifier = Modifier.padding(SgmSpacing.X5),
            verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        ) {
            Text(kicker, color = SgmColors.GreenLight, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Text(title, color = SgmColors.Surface, fontSize = 30.sp, lineHeight = 31.sp, fontWeight = FontWeight.Black)
            Text(detail, color = SgmColors.Surface.copy(alpha = 0.76f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(SgmSpacing.X2)) {
                SgmButton(primary, onPrimary, modifier = Modifier.weight(1f), light = true)
                SgmButton(secondary, onSecondary, modifier = Modifier.weight(1f), secondary = true)
            }
        }
    }
}

@Composable
fun GridAccent(modifier: Modifier = Modifier, cellSize: Int = 14, alpha: Float = 0.08f) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy((cellSize / 2).dp)) {
        repeat(5) {
            Row(horizontalArrangement = Arrangement.spacedBy((cellSize / 2).dp)) {
                repeat(4) {
                    Box(
                        modifier = Modifier
                            .size(cellSize.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(SgmColors.Surface.copy(alpha = alpha)),
                    )
                }
            }
        }
    }
}

@Composable
fun SectionHeader(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title.uppercase(),
            color = SgmColors.TextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp,
            modifier = Modifier.weight(1f),
        )
        if (action != null && onAction != null) {
            Text(
                action.uppercase(),
                color = SgmColors.Green,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

@Composable
fun SectionMiniTitle(title: String) {
    Text(
        title.uppercase(),
        color = SgmColors.TextPrimary,
        fontSize = 14.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.sp,
    )
}

@Composable
fun SgmCard(
    modifier: Modifier = Modifier,
    background: Color = SgmColors.Card,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(background)
            .padding(SgmSpacing.X4),
        verticalArrangement = Arrangement.spacedBy(SgmSpacing.X3),
        content = content,
    )
}

