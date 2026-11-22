package be.sportgreenmoove.app.design

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

object SgmColor {
    val Green       = Color(0xFF3EBD6C)
    val GreenLight  = Color(0xFF60E896)
    val GreenDark   = Color(0xFF1A8A44)
    val Lime        = Color(0xFFA8F038)
    val Orange      = Color(0xFFF97316)
    val OrangeLight = Color(0xFFFB923C)
    val Red         = Color(0xFFEF4444)
    val TextOnGreen = Color.White

    val HeroStart = Color(0xFF0D2A18)
    val HeroEnd = Color(0xFF163D24)
    val HeroGradient = Brush.linearGradient(listOf(HeroStart, HeroEnd))
    val RewardGradient = Brush.linearGradient(listOf(Color(0xFF2A1505), Color(0xFF3D2410)))
}

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
    textMuted     = Color(0xFF56735E),
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
    textMuted     = Color(0xFF8AA892),
    textInverse   = Color(0xFF0C1B0E),
    border        = Color(0xFF1E3022),
    borderStrong  = Color(0xFF2E4A32),
)
