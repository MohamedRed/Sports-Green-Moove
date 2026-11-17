package be.sportgreenmoove.app.services

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import be.sportgreenmoove.app.data.EmergencyDialerResult
import be.sportgreenmoove.app.data.PersonalEmergencyContact

internal fun openEmergencyDialer(context: Context, contact: PersonalEmergencyContact): EmergencyDialerResult = try {
    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", contact.phone, null)))
    EmergencyDialerResult.Opened
} catch (_: ActivityNotFoundException) {
    EmergencyDialerResult.Unavailable
} catch (_: SecurityException) {
    EmergencyDialerResult.Denied
}
