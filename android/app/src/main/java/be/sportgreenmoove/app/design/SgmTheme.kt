/*
 * SgmTheme.kt
 * SPORTS GREEN-mOOVe Design System — Jetpack Compose token bridge
 *
 * Generated from tokens/colors.css, tokens/typography.css, tokens/spacing.css.
 * This file is the ONLY place colors/fonts/spacing may be defined.
 * Never inline hex values or font names in screen code.
 *
 * Fonts: place bebas_neue_regular.ttf, dm_sans_regular.ttf, dm_sans_medium.ttf,
 * dm_sans_bold.ttf in res/font/. Both families are free on Google Fonts.
 */

package be.sportgreenmoove.app.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.R

// ─────────────────────────────────────────────────────────────
// Fixed brand colors (identical in light & dark)
// ─────────────────────────────────────────────────────────────

object SgmColor {
    val Green       = Color(0xFF3EBD6C)   // primary
    val GreenLight  = Color(0xFF60E896)   // hover / highlight
    val GreenDark   = Color(0xFF1A8A44)   // pressed / deep
    val Lime        = Color(0xFFA8F038)   // energy accent
    val Orange      = Color(0xFFF97316)   // CO₂ / reward CTA
    val OrangeLight = Color(0xFFFB923C)
    val Red         = Color(0xFFEF4444)   // error / destructive
    val TextOnGreen = Color.White

    // Hero gradients (dark zones in BOTH modes)
    val HeroStart = Color(0xFF0D2A18)
    val HeroEnd = Color(0xFF163D24)
    val HeroGradient = Brush.linearGradient(listOf(HeroStart, HeroEnd))
    val RewardGradient = Brush.linearGradient(
        listOf(Color(0xFF2A1505), Color(0xFF3D2410)))
}

// ─────────────────────────────────────────────────────────────
// Adaptive semantic colors
// ─────────────────────────────────────────────────────────────

@Suppress("PropertyName")
class SgmSemanticColors(
    val bgApp: Color,
    val bgSurface: Color,
    val bgCard: Color,
    val bgElevated: Color,
    val bgInput: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textInverse: Color,
    val border: Color,
    val borderStrong: Color,
)

val SgmLightColors = SgmSemanticColors(
    bgApp         = Color(0xFFF1F8F3),
    bgSurface     = Color(0xFFFFFFFF),
    bgCard        = Color(0xFFE8F4ED),
    bgElevated    = Color(0xFFFFFFFF),
    bgInput       = Color(0xFFF0F7F2),
    textPrimary   = Color(0xFF0C1B0E),
    textSecondary = Color(0xFF3A5640),
    textMuted     = Color(0xFF7A9E82),
    textInverse   = Color(0xFFFFFFFF),
    border        = Color(0xFFD0E8D8),
    borderStrong  = Color(0xFF9EC9A9),
)

val SgmDarkColors = SgmSemanticColors(
    bgApp         = Color(0xFF0A0F0B),
    bgSurface     = Color(0xFF111815),
    bgCard        = Color(0xFF172019),
    bgElevated    = Color(0xFF1E2E20),
    bgInput       = Color(0xFF1A2A1C),
    textPrimary   = Color(0xFFEEF8F1),
    textSecondary = Color(0xFF90B898),
    textMuted     = Color(0xFF4E6E56),
    textInverse   = Color(0xFF0C1B0E),
    border        = Color(0xFF1E3022),
    borderStrong  = Color(0xFF2E4A32),
)

val LocalSgmColors = staticCompositionLocalOf { SgmLightColors }

// ─────────────────────────────────────────────────────────────
// Typography
// Display (Bebas Neue): headings, stats, nav labels — ALWAYS uppercase.
// Body (DM Sans): everything else. Sizes match CSS scale 1:1 (px → sp).
// ─────────────────────────────────────────────────────────────

val BebasNeue = FontFamily(Font(R.font.bebas_neue_regular))
val DmSans = FontFamily(
    Font(R.font.dm_sans_regular, FontWeight.Normal),
    Font(R.font.dm_sans_medium, FontWeight.Medium),
    Font(R.font.dm_sans_bold, FontWeight.Bold),
)

object SgmType {
    // Display — Bebas Neue (tracking baked in per CSS: wide 0.06em … widest 0.2em)
    val Display5XL = TextStyle(fontFamily = BebasNeue, fontSize = 80.sp, lineHeight = 80.sp)            // hero numerals
    val Display4XL = TextStyle(fontFamily = BebasNeue, fontSize = 60.sp, lineHeight = 60.sp)            // big stats
    val Display3XL = TextStyle(fontFamily = BebasNeue, fontSize = 44.sp, lineHeight = 42.sp, letterSpacing = 0.02.em)  // screen heroes
    val Display2XL = TextStyle(fontFamily = BebasNeue, fontSize = 32.sp, lineHeight = 31.sp, letterSpacing = 0.04.em)  // section titles
    val DisplayXL  = TextStyle(fontFamily = BebasNeue, fontSize = 24.sp, lineHeight = 24.sp, letterSpacing = 0.04.em)  // card titles
    val DisplayLG  = TextStyle(fontFamily = BebasNeue, fontSize = 20.sp, lineHeight = 21.sp, letterSpacing = 0.06.em)  // list headings
    val Eyebrow    = TextStyle(fontFamily = BebasNeue, fontSize = 13.sp, letterSpacing = 0.2.em)                       // eyebrows
    val NavLabel   = TextStyle(fontFamily = BebasNeue, fontSize = 9.sp,  letterSpacing = 0.08.em)                      // bottom-nav labels

    // Body — DM Sans
    val BodyLG   = TextStyle(fontFamily = DmSans, fontSize = 17.sp, lineHeight = 25.sp)
    val BodyBase = TextStyle(fontFamily = DmSans, fontSize = 15.sp, lineHeight = 22.sp)
    val BodySM   = TextStyle(fontFamily = DmSans, fontSize = 13.sp, lineHeight = 19.sp)
    val BodyXS   = TextStyle(fontFamily = DmSans, fontSize = 11.sp, lineHeight = 16.sp)
    val Label    = TextStyle(fontFamily = DmSans, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.04.em)  // buttons, chips
}

private val SgmMaterialTypography = Typography(
    displayLarge = SgmType.Display3XL,
    displayMedium = SgmType.Display2XL,
    displaySmall = SgmType.DisplayXL,
    headlineLarge = SgmType.Display2XL,
    headlineMedium = SgmType.DisplayXL,
    headlineSmall = SgmType.DisplayLG,
    titleLarge = SgmType.DisplayXL,
    titleMedium = SgmType.DisplayLG,
    titleSmall = SgmType.Eyebrow,
    bodyLarge = SgmType.BodyLG,
    bodyMedium = SgmType.BodyBase,
    bodySmall = SgmType.BodySM,
    labelLarge = SgmType.Label,
    labelMedium = SgmType.BodyXS,
    labelSmall = SgmType.NavLabel,
)

// ─────────────────────────────────────────────────────────────
// Spacing (4dp grid — CSS px → dp 1:1)
// ─────────────────────────────────────────────────────────────

object SgmSpace {
    val S1 = 4.dp
    val S2 = 8.dp
    val S3 = 12.dp
    val S4 = 16.dp
    val S5 = 20.dp
    val S6 = 24.dp
    val S8 = 32.dp
    val S10 = 40.dp
    val S12 = 48.dp
    val S16 = 64.dp

    val PadScreen = 20.dp   // --pad-screen
    val PadCard   = 16.dp   // --pad-card
}

object SgmRadius {
    val SM  = 8.dp
    val MD  = 12.dp
    val LG  = 16.dp
    val XL  = 20.dp
    val XXL = 28.dp
    // Pills/badges/chips: use RoundedCornerShape(50) / CircleShape.
}

object SgmSize {
    val BtnSM  = 36.dp
    val BtnMD  = 48.dp
    val BtnLG  = 56.dp
    val NavBar = 64.dp
    val Header = 56.dp
    val Fab    = 44.dp     // green circle in bottom nav
}

// ─────────────────────────────────────────────────────────────
// Theme wrapper
// ─────────────────────────────────────────────────────────────

@Composable
fun SgmTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val sgmColors = if (darkTheme) SgmDarkColors else SgmLightColors

    val materialScheme = if (darkTheme) darkColorScheme(
        primary = SgmColor.Green,
        secondary = SgmColor.Orange,
        background = sgmColors.bgApp,
        surface = sgmColors.bgSurface,
        error = SgmColor.Red,
        onPrimary = SgmColor.TextOnGreen,
        onBackground = sgmColors.textPrimary,
        onSurface = sgmColors.textPrimary,
    ) else lightColorScheme(
        primary = SgmColor.Green,
        secondary = SgmColor.Orange,
        background = sgmColors.bgApp,
        surface = sgmColors.bgSurface,
        error = SgmColor.Red,
        onPrimary = SgmColor.TextOnGreen,
        onBackground = sgmColors.textPrimary,
        onSurface = sgmColors.textPrimary,
    )

    CompositionLocalProvider(LocalSgmColors provides sgmColors) {
        MaterialTheme(
            colorScheme = materialScheme,
            typography = SgmMaterialTypography,
            content = content,
        )
    }
}

/** Access semantic colors from any composable: `SgmTheme.colors.bgCard` style usage. */
object Sgm {
    val colors: SgmSemanticColors
        @Composable get() = LocalSgmColors.current
}

// ─────────────────────────────────────────────────────────────
// Grid texture
// The faint green "map grid" — reserved for hero cards, CO₂ zones,
// onboarding. Do not apply to ordinary cards.
// ─────────────────────────────────────────────────────────────

@Composable
fun BoxScope.SgmGridTexture(
    modifier: Modifier = Modifier,
    spacing: Float = 24f,
    lineColor: Color = SgmColor.Green.copy(alpha = 0.07f),
) {
    Canvas(modifier = modifier.matchParentSize()) {
        var x = 0f
        while (x <= size.width) {
            drawLine(lineColor, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
            x += spacing
        }
        var y = 0f
        while (y <= size.height) {
            drawLine(lineColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
            y += spacing
        }
    }
}
