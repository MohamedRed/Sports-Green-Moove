package be.sportgreenmoove.app.services

data class ChildAccountLinkCode(val accountUserId: String, val code: String, val expiresAtMillis: Long)
data class ChildAccountLinkTarget(val childId: String, val clubId: String, val childInstanceId: String, val childName: String)
data class ChildAccountLinkReceipt(val accountUserId: String, val childId: String, val childInstanceId: String)

interface ChildAccountLinkGateway {
    suspend fun createCode(uid: String): ChildAccountLinkCode
    suspend fun approve(uid: String, target: ChildAccountLinkTarget, code: String): ChildAccountLinkReceipt
}

class UnconfiguredChildAccountLinkGateway : ChildAccountLinkGateway {
    override suspend fun createCode(uid: String): ChildAccountLinkCode = throw ProviderConfigurationException("Liaison du compte indisponible.")
    override suspend fun approve(uid: String, target: ChildAccountLinkTarget, code: String): ChildAccountLinkReceipt =
        throw ProviderConfigurationException("Liaison du compte indisponible.")
}
