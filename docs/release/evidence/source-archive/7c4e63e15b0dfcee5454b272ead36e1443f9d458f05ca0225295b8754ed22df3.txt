package be.sportgreenmoove.app.ui

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.junit.Assert.*
import org.junit.Test

class ForegroundReturnIntentTest {
    @Test fun aLauncherReturnPreservesTheObservedIntentInsteadOfReplacingItsActionAndCategories() {
        val launchFlags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val original = Intent.makeMainActivity(ComponentName("be.sportgreenmoove.app.local", "be.sportgreenmoove.app.MainActivity"))
            .setFlags(launchFlags)
        val returned = returnToForegroundIntent(original)
        assertNotSame(original, returned)
        assertTrue(original.filterEquals(returned))
        assertEquals(launchFlags, original.flags)
        assertEquals(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT, returned.flags)
    }

    @Test fun returningAnExistingDeepLinkPreservesItsDataTypePackageIdentifierAndExtras() {
        val original = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse("https://example.test/qa"), "text/plain")
            .setPackage("be.sportgreenmoove.app.local").addCategory(Intent.CATEGORY_BROWSABLE)
            .putExtra("synthetic-extra", "unchanged")
        if (Build.VERSION.SDK_INT >= 29) original.identifier = "synthetic-return"
        val returned = returnToForegroundIntent(original)
        assertTrue(original.filterEquals(returned))
        assertEquals("unchanged", returned.getStringExtra("synthetic-extra"))
        if (Build.VERSION.SDK_INT >= 29) assertEquals("synthetic-return", returned.identifier)
    }
}
