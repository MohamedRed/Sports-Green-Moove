package be.sportgreenmoove.app.ui

import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import android.content.Context

@Composable
fun rememberAppDarkTheme() = LocalContext.current.let { context ->
    val preferences = remember { context.getSharedPreferences("appearance", Context.MODE_PRIVATE) }
    val state = remember { mutableStateOf(preferences.getBoolean("darkTheme", false)) }
    SideEffect { preferences.edit().putBoolean("darkTheme", state.value).apply() }
    state
}

@Composable
fun AppSystemBars(darkBackground: Boolean) {
    val activity = LocalContext.current.findActivity() as? ComponentActivity
    DisposableEffect(activity, darkBackground) {
        val style = if (darkBackground) SystemBarStyle.dark(Color.TRANSPARENT)
            else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        activity?.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
        onDispose { }
    }
}
