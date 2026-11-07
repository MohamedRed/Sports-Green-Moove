package be.sportgreenmoove.qa.installguard

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.UserManager

class InstallationPolicyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        resultCode = Activity.RESULT_CANCELED
        resultData = "SGM_INSTALL_POLICY_REFUSED"
        try {
            check(intent.action == "be.sportgreenmoove.qa.installguard.SET_BLOCKED")
            check(intent.hasExtra("blocked") && intent.extras?.get("blocked") is Boolean)
            check(Build.VERSION.SDK_INT == 35 && Build.HARDWARE in setOf("ranchu", "goldfish"))
            val users = context.getSystemService(UserManager::class.java)
            check(users.isSystemUser)
            val policy = context.getSystemService(DevicePolicyManager::class.java)
            val admin = ComponentName(context, GuardAdminReceiver::class.java)
            check(policy.isDeviceOwnerApp(context.packageName) && policy.isAdminActive(admin))
            val blocked = intent.getBooleanExtra("blocked", false)
            if (blocked) policy.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS)
            else policy.clearUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS)
            check(users.hasUserRestriction(UserManager.DISALLOW_INSTALL_APPS) == blocked)
            resultCode = Activity.RESULT_OK
            resultData = "SGM_INSTALL_BLOCKED=$blocked"
        } catch (_: Exception) {
            // Never expose intent contents or continue with an unconfirmed policy.
        }
    }
}
