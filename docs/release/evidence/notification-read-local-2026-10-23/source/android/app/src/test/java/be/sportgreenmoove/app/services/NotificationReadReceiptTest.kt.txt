package be.sportgreenmoove.app.services

import org.junit.Assert.*
import org.junit.Test

class NotificationReadReceiptTest {
    @Test fun acceptsOnlyTheExactConfirmedOwnerAndNotice() {
        requireNotificationReadReceipt(mapOf("userId" to "parent", "notificationId" to "one", "read" to true), "parent", "one")
    }
    @Test fun rejectsMissingWrongOwnerWrongNoticeAndUnconfirmedReceipts() {
        for (value in listOf(null, emptyMap<String, Any>(),
            mapOf("userId" to "other", "notificationId" to "one", "read" to true),
            mapOf("userId" to "parent", "notificationId" to "two", "read" to true),
            mapOf("userId" to "parent", "notificationId" to "one", "read" to false),
            mapOf("userId" to "parent", "notificationId" to "one", "read" to "true"))) {
            try { requireNotificationReadReceipt(value, "parent", "one"); fail("Unconfirmed receipt accepted") }
            catch (_: ProviderConfigurationException) { }
        }
    }
}
