package be.sportgreenmoove.app

import android.graphics.Color
import android.content.Intent
import android.os.Bundle
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import be.sportgreenmoove.app.services.FacebookActivityResultBridge
import be.sportgreenmoove.app.services.AndroidTeamPushRuntime
import be.sportgreenmoove.app.services.TeamPushOpenRequest
import be.sportgreenmoove.app.services.teamPushOpenRequest
import be.sportgreenmoove.app.services.teamPushOpenAction
import be.sportgreenmoove.app.ui.SportsGreenMooveApp

class MainActivity : ComponentActivity() {
    private var teamAlert by mutableStateOf<TeamPushOpenRequest?>(null)
    private var teamAlertAttempt by mutableStateOf(0L)
    override fun onResume() {
        super.onResume()
        AndroidTeamPushRuntime.resumed(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        teamAlert = teamPushOpenRequest(intent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) setRecentsScreenshotEnabled(false)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent {
            SportsGreenMooveApp(teamAlertRequest = teamAlert, teamAlertAttempt = teamAlertAttempt, onTeamAlertConsumed = ::consumeTeamAlert)
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        teamAlert = teamPushOpenRequest(intent)
        teamAlertAttempt++
    }
    private fun consumeTeamAlert() {
        teamAlert = null
        if (intent?.action == teamPushOpenAction) setIntent(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_MAIN))
    }

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (FacebookActivityResultBridge.onActivityResult(requestCode, resultCode, data)) return
        super.onActivityResult(requestCode, resultCode, data)
    }
}
