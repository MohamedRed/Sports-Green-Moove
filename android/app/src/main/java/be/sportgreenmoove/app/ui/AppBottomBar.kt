package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmSize
import be.sportgreenmoove.app.design.SgmType

@Composable
fun AppBottomBar(current: DemoScreen, onNavigate: (DemoScreen) -> Unit) {
    val items = listOf(
        NavItem(DemoScreen.Home, SgmIcon.Home, "Accueil"),
        NavItem(DemoScreen.Trips, SgmIcon.Calendar, "Trajets"),
        NavItem(DemoScreen.Publish, SgmIcon.Plus, ""),
        NavItem(DemoScreen.Messages, SgmIcon.Chat, "Messages"),
        NavItem(DemoScreen.Profile, SgmIcon.Profile, "Profil"),
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Sgm.colors.bgSurface)
            .border(BorderStroke(1.dp, Sgm.colors.border)),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(SgmSize.NavBar)
                .padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEach { item ->
                if (item.screen == DemoScreen.Publish) {
                    PublishNavButton(onClick = { onNavigate(DemoScreen.Publish) }, modifier = Modifier.weight(1f))
                } else {
                    BottomNavButton(
                        item = item,
                        selected = current == item.screen,
                        onClick = { onNavigate(item.screen) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        Spacer(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsBottomHeight(WindowInsets.navigationBars),
        )
    }
}

@Composable
private fun PublishNavButton(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.height(SgmSize.NavBar),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .offset(y = (-8).dp)
                .size(50.dp)
                .clip(CircleShape)
                .background(SgmColor.Green)
                .border(BorderStroke(3.dp, Sgm.colors.bgSurface), CircleShape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            SgmLineIcon(icon = SgmIcon.Plus, tint = SgmColor.TextOnGreen, modifier = Modifier.size(22.dp))
        }
    }
}

@Composable
private fun BottomNavButton(item: NavItem, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .height(SgmSize.NavBar)
            .clickable(onClick = onClick)
            .padding(top = 9.dp, bottom = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        SgmLineIcon(
            icon = item.icon,
            tint = if (selected) SgmColor.Green else Sgm.colors.textMuted,
            modifier = Modifier.size(if (selected) 22.dp else 20.dp),
        )
        Spacer(Modifier.height(3.dp))
        Text(
            item.label,
            style = SgmType.NavLabel.copy(
                color = if (selected) SgmColor.Green else Sgm.colors.textMuted,
                fontSize = 9.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            ),
            maxLines = 1,
        )
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier
                .size(4.dp)
                .clip(CircleShape)
                .background(if (selected) SgmColor.Green else androidx.compose.ui.graphics.Color.Transparent),
        )
    }
}

private data class NavItem(
    val screen: DemoScreen,
    val icon: SgmIcon,
    val label: String,
)
