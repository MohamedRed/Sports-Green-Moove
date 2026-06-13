package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import be.sportgreenmoove.app.design.Sgm

@Composable
fun SportsGreenMooveScaffold(
    currentScreen: AppScreen,
    onNavigate: (AppScreen) -> Unit,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        containerColor = Sgm.colors.bgApp,
        bottomBar = {
            AppBottomBar(
                current = currentScreen.toTopLevel(),
                onNavigate = onNavigate,
            )
        },
    ) { padding ->
        content(padding)
    }
}
