package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import be.sportgreenmoove.app.design.Sgm

@Composable
fun SportsGreenMooveScaffold(
    currentScreen: AppScreen,
    onNavigate: (AppScreen) -> Unit,
    notice: String? = null,
    error: String? = null,
    onDismissMessage: () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        containerColor = Sgm.colors.bgApp,
        topBar = {
            if (notice != null || error != null) {
                Box(Modifier.statusBarsPadding()) {
                    RuntimeNoticeHost(notice = notice, error = error, onDismiss = onDismissMessage)
                }
            }
        },
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
