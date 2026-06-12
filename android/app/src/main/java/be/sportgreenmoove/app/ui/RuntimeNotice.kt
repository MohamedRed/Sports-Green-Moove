package be.sportgreenmoove.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType

@Composable
fun RuntimeNotice(message: String, warning: Boolean, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    Text(
        text = message,
        style = SgmType.BodyXS.copy(
            color = if (warning) SgmColor.Orange else SgmColor.Green,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        ),
        modifier = modifier
            .padding(horizontal = 20.dp, vertical = 10.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Sgm.colors.bgCard)
            .border(
                width = 1.dp,
                color = if (warning) SgmColor.Orange.copy(alpha = 0.42f) else Sgm.colors.border,
                shape = RoundedCornerShape(14.dp),
            )
            .clickable(onClick = onDismiss)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    )
}
