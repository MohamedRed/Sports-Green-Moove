package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.PayableBookingSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmRadius
import be.sportgreenmoove.app.design.SgmType

@Composable
fun PaymentsScreen(
    bookings: List<PayableBookingSummary>,
    loading: Boolean,
    onBack: () -> Unit,
    onPay: (PayableBookingSummary) -> Unit,
) {
    V2Screen {
        V2TopBar("PAIEMENTS", onBack = onBack)
        PaymentsHero(bookings = bookings)
        V2SectionLabel("À RÉGLER")
        if (bookings.isEmpty()) {
            PaymentsEmptyCard()
        } else {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                bookings.forEach { booking ->
                    PaymentBookingCard(
                        booking = booking,
                        loading = loading,
                        onPay = { if (!loading) onPay(booking) },
                    )
                }
            }
        }
        Box(Modifier.padding(bottom = 76.dp))
    }
}

@Composable
private fun PaymentsHero(bookings: List<PayableBookingSummary>) {
    val totalCents = bookings.sumOf { it.amountCents }
    Box(
        modifier = Modifier
            .padding(start = 20.dp, top = 4.dp, end = 20.dp, bottom = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(SgmColor.HeroGradient)
            .padding(20.dp),
    ) {
        SgmGridTexture()
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("STRIPE PAYMENTSHEET", style = SgmType.Label.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.52f), fontSize = 11.sp, letterSpacing = 0.14.em))
            Text(formatEuros(totalCents), style = SgmType.Display3XL.copy(color = SgmColor.Green, fontSize = 42.sp))
            Text(
                "${bookings.size} réservation${if (bookings.size > 1) "s" else ""} approuvée${if (bookings.size > 1) "s" else ""} en attente de paiement.",
                style = SgmType.BodySM.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.68f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            )
        }
    }
}

@Composable
private fun PaymentBookingCard(
    booking: PayableBookingSummary,
    loading: Boolean,
    onPay: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            V2Avatar(initials = booking.club.take(2), size = 42)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(booking.title, style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${booking.dateLabel} · ${booking.timeLabel} · ${booking.seats} place${if (booking.seats > 1) "s" else ""}", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium))
            }
            Text(booking.amountLabel, style = SgmType.DisplayXL.copy(color = SgmColor.Orange, fontSize = 22.sp))
        }
        V2Button(
            title = if (loading) "Préparation..." else "Payer maintenant",
            onClick = onPay,
            variant = V2ButtonVariant.Primary,
            size = V2ButtonSize.Md,
            full = true,
        )
    }
}

@Composable
private fun PaymentsEmptyCard() {
    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(SgmRadius.LG))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(SgmRadius.LG))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(SgmColor.Green.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            SgmLineIcon(SgmIcon.Award, tint = SgmColor.Green, modifier = Modifier.size(20.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("Aucun paiement dû", style = SgmType.BodyBase.copy(color = Sgm.colors.textPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold))
            Text("Les réservations apparaissent ici après validation du conducteur.", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium))
        }
    }
}

private fun formatEuros(cents: Int): String =
    "%.2f€".format(cents.toDouble() / 100.0).replace(".", ",")
