package be.sportgreenmoove.app

import android.app.Application
import be.sportgreenmoove.app.services.AndroidTeamPushRuntime

class SgmApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AndroidTeamPushRuntime.start(this)
    }
}
