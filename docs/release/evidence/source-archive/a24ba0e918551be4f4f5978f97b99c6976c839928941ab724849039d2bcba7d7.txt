package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.StripeConnectAccount
import be.sportgreenmoove.app.data.StripeConnectAccountLink
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class StripeConnectCoordinatorTest {
    private class Gateway : StripePaymentsGateway by UnconfiguredStripePaymentsGateway() {
        override val isConfigured = true
        var accounts = 0; var links = 0
        var accountGate: CompletableDeferred<Unit>? = null
        var linkGate: CompletableDeferred<Unit>? = null
        var failure: Exception? = null
        var url = "https://connect.stripe.com/setup/synthetic"
        override suspend fun createStripeAccount(email: String): StripeConnectAccount {
            accounts++; accountGate?.await(); failure?.let { throw it }; return StripeConnectAccount("acct_synthetic")
        }
        override suspend fun createStripeAccountLink(returnUrl: String, refreshUrl: String): StripeConnectAccountLink {
            links++; linkGate?.await(); return StripeConnectAccountLink(url, null)
        }
    }
    private class Harness {
        val gateway = Gateway()
        var owner: StripeConnectOwner? = StripeConnectOwner("driver", "d@example.test", AppRole.Driver)
        var blocked = false
        var urls: StripeConnectUrls? = StripeConnectUrls("https://example.test/return", "https://example.test/refresh")
        val opened = mutableListOf<String>(); val errors = mutableListOf<String>(); val notices = mutableListOf<String>()
        val coordinator = StripeConnectCoordinator(gateway, { owner }, { blocked }, { if (it != null) errors.add(it) },
            { if (it != null) notices.add(it) })
        suspend fun start() = coordinator.start(urls) { opened.add(it) }
    }
    @Test fun successOpensOnceWithoutClaimingThatVerificationOrPayoutFinished() = runBlocking {
        val h = Harness(); h.start()
        assertEquals(1, h.gateway.accounts); assertEquals(1, h.gateway.links); assertEquals(listOf(h.gateway.url), h.opened)
        assertEquals(listOf("Poursuivez l’inscription dans votre navigateur."), h.notices); assertFalse(h.coordinator.busy)
    }
    @Test fun repeatedTapsCannotStartAnotherAccountOrLink() = runBlocking {
        val h = Harness(); h.gateway.accountGate = CompletableDeferred()
        val job = launch { h.start() }; yield(); assertTrue(h.coordinator.busy)
        h.start(); assertEquals(1, h.gateway.accounts)
        h.gateway.accountGate!!.complete(Unit); job.join(); assertEquals(1, h.gateway.links)
    }
    @Test fun changedAccountAfterAccountCreationCannotRequestALink() = runBlocking {
        val h = Harness(); h.gateway.accountGate = CompletableDeferred()
        val job = launch { h.start() }; yield(); h.owner = h.owner!!.copy(uid = "other")
        h.gateway.accountGate!!.complete(Unit); job.join()
        assertEquals(0, h.gateway.links); assertTrue(h.opened.isEmpty()); assertTrue(h.notices.isEmpty())
    }
    @Test fun changedRoleWhileLinkLoadsCannotOpenIt() = runBlocking {
        val h = Harness(); h.gateway.linkGate = CompletableDeferred()
        val job = launch { h.start() }; yield(); h.owner = h.owner!!.copy(role = AppRole.Parent)
        h.gateway.linkGate!!.complete(Unit); job.join(); assertTrue(h.opened.isEmpty()); assertTrue(h.notices.isEmpty())
    }
    @Test fun signOutWhileLinkLoadsCannotOpenIt() = runBlocking {
        val h = Harness(); h.gateway.linkGate = CompletableDeferred()
        val job = launch { h.start() }; yield(); h.owner = null
        h.gateway.linkGate!!.complete(Unit); job.join(); assertTrue(h.opened.isEmpty()); assertTrue(h.errors.isEmpty())
    }
    @Test fun staleProviderErrorsCannotAppearForAnotherAccount() = runBlocking {
        val h = Harness(); h.gateway.accountGate = CompletableDeferred(); h.gateway.failure = IllegalStateException("private error")
        val job = launch { h.start() }; yield(); h.owner = h.owner!!.copy(uid = "other")
        h.gateway.accountGate!!.complete(Unit); job.join(); assertTrue(h.errors.isEmpty())
    }
    @Test fun cancelledWorkReleasesBusyWithoutPublishingAnError() = runBlocking {
        val h = Harness(); h.gateway.accountGate = CompletableDeferred()
        val job = launch { h.start() }; yield(); job.cancelAndJoin()
        assertFalse(h.coordinator.busy); assertTrue(h.errors.isEmpty()); assertTrue(h.opened.isEmpty())
    }
    @Test fun incompleteOrNonDriverIdentityNeverCallsTheProvider() = runBlocking {
        for (owner in listOf(null, StripeConnectOwner("", "d@example.test", AppRole.Driver),
            StripeConnectOwner("driver", " ", AppRole.Driver), StripeConnectOwner("parent", "p@example.test", AppRole.Parent))) {
            val h = Harness(); h.owner = owner; h.start()
            assertEquals(0, h.gateway.accounts); assertEquals(0, h.gateway.links); assertTrue(h.opened.isEmpty())
        }
    }
    @Test fun unavailableConfigurationAndExistingPaymentPreventProviderCalls() = runBlocking {
        val h = Harness(); h.urls = null; h.start(); assertEquals(0, h.gateway.accounts)
        assertEquals(listOf("L’inscription conducteur est indisponible pour le moment. Contactez le support."), h.errors)
        h.urls = StripeConnectUrls("https://example.test/r", "https://example.test/f"); h.blocked = true; h.start()
        assertEquals(0, h.gateway.accounts)
    }
    @Test fun configurationErrorsNeverExposeProviderDetails() = runBlocking {
        val h = Harness(); h.gateway.failure = ProviderConfigurationException("SGM_PRIVATE_KEY diagnostic")
        h.start(); assertEquals(listOf("L’inscription conducteur est indisponible pour le moment. Contactez le support."), h.errors)
        assertTrue(h.opened.isEmpty()); assertFalse(h.coordinator.busy)
    }
    @Test fun invalidLinksAndBrowserFailureDoNotReportSuccess() = runBlocking {
        for (url in listOf("javascript:alert(1)", "http://example.test", "https://user:pass@example.test", "not a URL")) {
            val h = Harness(); h.gateway.url = url; h.start(); assertTrue(h.opened.isEmpty()); assertTrue(h.notices.isEmpty())
        }
        val h = Harness(); h.coordinator.start(h.urls) { throw IllegalStateException("raw browser detail") }
        assertTrue(h.notices.isEmpty()); assertFalse(h.coordinator.busy); assertEquals(1, h.errors.size)
    }
}
