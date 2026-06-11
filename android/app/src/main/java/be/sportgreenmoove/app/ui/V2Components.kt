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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun V2Screen(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Sgm.colors.bgApp)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 20.dp),
        content = content,
    )
}

@Composable
fun V2TopBar(title: String, onBack: (() -> Unit)? = null, trailing: @Composable (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 34.dp, end = 20.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (onBack != null) V2CircleIconButton(SgmIcon.ChevronLeft, onClick = onBack)
        Text(
            title,
            style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 22.sp, letterSpacing = 0.08.em),
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        trailing?.invoke() ?: V2CircleIconButton(SgmIcon.Moon)
    }
}

@Composable
fun V2CircleIconButton(icon: SgmIcon, onClick: () -> Unit = {}, size: Int = 36, selected: Boolean = false) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(if (selected) SgmColor.Green else Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        SgmLineIcon(
            icon = icon,
            tint = if (selected) SgmColor.TextOnGreen else Sgm.colors.textSecondary,
            modifier = Modifier.size(16.dp),
        )
    }
}

@Composable
fun V2SectionLabel(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            title,
            style = SgmType.DisplayLG.copy(color = Sgm.colors.textPrimary, fontSize = 19.sp, letterSpacing = 0.08.em),
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (action != null && onAction != null) {
            Text(action, style = SgmType.BodyXS.copy(color = SgmColor.Green, fontSize = 12.sp, fontWeight = FontWeight.SemiBold), modifier = Modifier.clickable(onClick = onAction))
        }
    }
}

@Composable
fun V2Button(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: V2ButtonVariant = V2ButtonVariant.Primary,
    size: V2ButtonSize = V2ButtonSize.Md,
    full: Boolean = false,
) {
    val bg = when (variant) {
        V2ButtonVariant.Primary -> SgmColor.Green
        V2ButtonVariant.Secondary -> Sgm.colors.bgCard
        V2ButtonVariant.Ghost -> Color.Transparent
        V2ButtonVariant.Orange -> SgmColor.Orange
    }
    val fg = when (variant) {
        V2ButtonVariant.Primary, V2ButtonVariant.Orange -> SgmColor.TextOnGreen
        V2ButtonVariant.Secondary -> Sgm.colors.textPrimary
        V2ButtonVariant.Ghost -> SgmColor.Green
    }
    val border = when (variant) {
        V2ButtonVariant.Primary, V2ButtonVariant.Orange -> null
        V2ButtonVariant.Secondary -> BorderStroke(1.dp, Sgm.colors.border)
        V2ButtonVariant.Ghost -> BorderStroke(1.5.dp, SgmColor.Green)
    }
    Box(
        modifier = modifier
            .then(if (full) Modifier.fillMaxWidth() else Modifier)
            .height(size.height)
            .clip(RoundedCornerShape(SgmRadius.MD))
            .background(bg)
            .then(if (border != null) Modifier.border(border, RoundedCornerShape(SgmRadius.MD)) else Modifier)
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(title.uppercase(), style = SgmType.Label.copy(color = fg, fontSize = size.fontSize, letterSpacing = 0.04.em), textAlign = TextAlign.Center)
    }
}

@Composable
fun V2Chip(text: String, selected: Boolean, onClick: () -> Unit = {}, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) SgmColor.Green else Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = SgmType.Label.copy(color = if (selected) SgmColor.TextOnGreen else Sgm.colors.textMuted, fontSize = 11.sp, letterSpacing = 0.04.em), maxLines = 1)
    }
}

@Composable
fun V2Avatar(initials: String, size: Int = 32, color: Color = SgmColor.Green) {
    Box(modifier = Modifier.size(size.dp).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
        Text(initials.take(2).uppercase(), style = SgmType.BodyXS.copy(color = SgmColor.TextOnGreen, fontSize = (size * 0.30f).sp, fontWeight = FontWeight.Bold))
    }
}

@Composable
fun V2ProgressBar(progress: Float, modifier: Modifier = Modifier, brush: Brush = Brush.horizontalGradient(listOf(SgmColor.Green, SgmColor.Orange))) {
    Box(modifier = modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(999.dp)).background(Sgm.colors.border)) {
        Box(modifier = Modifier.fillMaxWidth(progress).height(6.dp).clip(RoundedCornerShape(999.dp)).background(brush))
    }
}

enum class V2ButtonVariant { Primary, Secondary, Ghost, Orange }
enum class V2ButtonSize(val height: androidx.compose.ui.unit.Dp, val fontSize: androidx.compose.ui.unit.TextUnit) {
    Sm(36.dp, 14.sp),
    Md(48.dp, 14.sp),
    Lg(56.dp, 16.sp),
}
