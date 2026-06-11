package be.sportgreenmoove.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

enum class SgmIcon {
    Home,
    Calendar,
    Chat,
    Profile,
    Plus,
    Moon,
    Search,
    ChevronLeft,
    ChevronRight,
    Location,
    Groups,
    Award,
    Bell,
    Settings,
    ArrowRight,
}

@Composable
fun SgmLineIcon(
    icon: SgmIcon,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier) {
        val stroke = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
        fun p(x: Float, y: Float) = Offset(size.width * x, size.height * y)

        when (icon) {
            SgmIcon.Home -> {
                drawLine(tint, p(0.16f, 0.48f), p(0.50f, 0.18f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.50f, 0.18f), p(0.84f, 0.48f), stroke.width, StrokeCap.Round)
                drawPath(Path().apply {
                    moveTo(size.width * 0.25f, size.height * 0.45f)
                    lineTo(size.width * 0.25f, size.height * 0.82f)
                    lineTo(size.width * 0.40f, size.height * 0.82f)
                    lineTo(size.width * 0.40f, size.height * 0.58f)
                    lineTo(size.width * 0.60f, size.height * 0.58f)
                    lineTo(size.width * 0.60f, size.height * 0.82f)
                    lineTo(size.width * 0.75f, size.height * 0.82f)
                    lineTo(size.width * 0.75f, size.height * 0.45f)
                }, tint, style = stroke)
            }

            SgmIcon.Calendar -> {
                drawRoundRect(tint, topLeft = p(0.18f, 0.22f), size = Size(size.width * 0.64f, size.height * 0.62f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3.dp.toPx()), style = stroke)
                drawLine(tint, p(0.18f, 0.40f), p(0.82f, 0.40f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.34f, 0.14f), p(0.34f, 0.28f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.66f, 0.14f), p(0.66f, 0.28f), stroke.width, StrokeCap.Round)
            }

            SgmIcon.Chat -> {
                drawPath(Path().apply {
                    moveTo(size.width * 0.18f, size.height * 0.24f)
                    lineTo(size.width * 0.82f, size.height * 0.24f)
                    lineTo(size.width * 0.82f, size.height * 0.66f)
                    lineTo(size.width * 0.40f, size.height * 0.66f)
                    lineTo(size.width * 0.20f, size.height * 0.82f)
                    lineTo(size.width * 0.22f, size.height * 0.66f)
                    lineTo(size.width * 0.18f, size.height * 0.66f)
                    close()
                }, tint, style = stroke)
            }

            SgmIcon.Profile -> {
                drawCircle(tint, radius = size.minDimension * 0.16f, center = p(0.50f, 0.32f), style = stroke)
                drawArc(tint, startAngle = 205f, sweepAngle = 130f, useCenter = false, topLeft = p(0.24f, 0.50f), size = Size(size.width * 0.52f, size.height * 0.42f), style = stroke)
            }

            SgmIcon.Plus -> {
                drawLine(tint, p(0.50f, 0.24f), p(0.50f, 0.76f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.24f, 0.50f), p(0.76f, 0.50f), stroke.width, StrokeCap.Round)
            }

            SgmIcon.Moon -> {
                drawCircle(tint, radius = size.minDimension * 0.28f, center = p(0.50f, 0.50f), style = stroke)
                drawCircle(Color.Transparent, radius = size.minDimension * 0.24f, center = p(0.62f, 0.40f), style = Stroke(width = 5.dp.toPx()))
            }

            SgmIcon.Search -> {
                drawCircle(tint, radius = size.minDimension * 0.22f, center = p(0.44f, 0.42f), style = stroke)
                drawLine(tint, p(0.60f, 0.60f), p(0.80f, 0.80f), stroke.width, StrokeCap.Round)
            }

            SgmIcon.ChevronLeft -> {
                drawLine(tint, p(0.62f, 0.24f), p(0.38f, 0.50f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.38f, 0.50f), p(0.62f, 0.76f), stroke.width, StrokeCap.Round)
            }

            SgmIcon.ChevronRight -> {
                drawLine(tint, p(0.38f, 0.24f), p(0.62f, 0.50f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.62f, 0.50f), p(0.38f, 0.76f), stroke.width, StrokeCap.Round)
            }

            SgmIcon.Location -> {
                drawPath(Path().apply {
                    moveTo(size.width * 0.50f, size.height * 0.88f)
                    cubicTo(size.width * 0.36f, size.height * 0.70f, size.width * 0.24f, size.height * 0.55f, size.width * 0.24f, size.height * 0.38f)
                    cubicTo(size.width * 0.24f, size.height * 0.23f, size.width * 0.36f, size.height * 0.14f, size.width * 0.50f, size.height * 0.14f)
                    cubicTo(size.width * 0.64f, size.height * 0.14f, size.width * 0.76f, size.height * 0.23f, size.width * 0.76f, size.height * 0.38f)
                    cubicTo(size.width * 0.76f, size.height * 0.55f, size.width * 0.64f, size.height * 0.70f, size.width * 0.50f, size.height * 0.88f)
                    close()
                }, tint, style = stroke)
                drawCircle(tint, radius = size.minDimension * 0.08f, center = p(0.50f, 0.38f), style = stroke)
            }

            SgmIcon.Groups -> {
                drawCircle(tint, radius = size.minDimension * 0.12f, center = p(0.40f, 0.34f), style = stroke)
                drawCircle(tint, radius = size.minDimension * 0.10f, center = p(0.66f, 0.38f), style = stroke)
                drawArc(tint, startAngle = 205f, sweepAngle = 130f, useCenter = false, topLeft = p(0.18f, 0.50f), size = Size(size.width * 0.44f, size.height * 0.32f), style = stroke)
                drawArc(tint, startAngle = 210f, sweepAngle = 120f, useCenter = false, topLeft = p(0.50f, 0.54f), size = Size(size.width * 0.34f, size.height * 0.26f), style = stroke)
            }

            SgmIcon.Award -> {
                drawCircle(tint, radius = size.minDimension * 0.22f, center = p(0.50f, 0.36f), style = stroke)
                drawLine(tint, p(0.40f, 0.56f), p(0.32f, 0.84f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.60f, 0.56f), p(0.68f, 0.84f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.32f, 0.84f), p(0.48f, 0.74f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.68f, 0.84f), p(0.52f, 0.74f), stroke.width, StrokeCap.Round)
            }

            SgmIcon.Bell -> {
                drawArc(tint, startAngle = 200f, sweepAngle = 140f, useCenter = false, topLeft = p(0.28f, 0.18f), size = Size(size.width * 0.44f, size.height * 0.50f), style = stroke)
                drawLine(tint, p(0.30f, 0.46f), p(0.22f, 0.72f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.70f, 0.46f), p(0.78f, 0.72f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.22f, 0.72f), p(0.78f, 0.72f), stroke.width, StrokeCap.Round)
                drawArc(tint, startAngle = 20f, sweepAngle = 140f, useCenter = false, topLeft = p(0.40f, 0.70f), size = Size(size.width * 0.20f, size.height * 0.14f), style = stroke)
            }

            SgmIcon.Settings -> {
                drawCircle(tint, radius = size.minDimension * 0.18f, center = p(0.50f, 0.50f), style = stroke)
                repeat(8) { index ->
                    val angle = Math.toRadians((index * 45).toDouble())
                    val cos = kotlin.math.cos(angle).toFloat()
                    val sin = kotlin.math.sin(angle).toFloat()
                    val inner = Offset(size.width * (0.50f + cos * 0.30f), size.height * (0.50f + sin * 0.30f))
                    val outer = Offset(size.width * (0.50f + cos * 0.40f), size.height * (0.50f + sin * 0.40f))
                    drawLine(tint, inner, outer, stroke.width, StrokeCap.Round)
                }
            }

            SgmIcon.ArrowRight -> {
                drawLine(tint, p(0.30f, 0.50f), p(0.70f, 0.50f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.54f, 0.34f), p(0.70f, 0.50f), stroke.width, StrokeCap.Round)
                drawLine(tint, p(0.54f, 0.66f), p(0.70f, 0.50f), stroke.width, StrokeCap.Round)
            }
        }
    }
}
