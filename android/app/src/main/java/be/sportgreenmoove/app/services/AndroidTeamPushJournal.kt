package be.sportgreenmoove.app.services

import android.content.Context
import java.io.File

internal fun androidTeamPushJournal(context: Context): TeamPushJournal =
    TeamPushJournal(FileTeamPushStorage(File(context.applicationContext.noBackupFilesDir, "team-phone-registration")))
