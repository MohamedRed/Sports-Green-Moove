package be.sportgreenmoove.app.services

import java.net.URI
import java.security.MessageDigest

data class ChildInvitationStatus(val invitationHash: String, val status: String, val expiresAtMillis: Long)
data class ChildInvitationLink(val childId: String, val childInstanceId: String, val url: String, val current: ChildInvitationStatus)

interface ChildInvitationGateway {
    suspend fun current(uid: String, target: ChildAccountLinkTarget): ChildInvitationStatus?
    suspend fun create(uid: String, target: ChildAccountLinkTarget): ChildInvitationLink
    suspend fun revoke(uid: String, target: ChildAccountLinkTarget, invitationHash: String)
}

class UnconfiguredChildInvitationGateway : ChildInvitationGateway {
    override suspend fun current(uid: String, target: ChildAccountLinkTarget): ChildInvitationStatus? = unavailable()
    override suspend fun create(uid: String, target: ChildAccountLinkTarget): ChildInvitationLink = unavailable()
    override suspend fun revoke(uid: String, target: ChildAccountLinkTarget, invitationHash: String): Unit = unavailable()
    private fun unavailable(): Nothing = throw ProviderConfigurationException("Invitation indisponible.")
}

internal fun validateInvitationLink(value: ChildInvitationLink, target: ChildAccountLinkTarget, now: Long) {
    val uri = URI(value.url)
    check(uri.scheme == "https" && uri.host == "sports-green-moove-prod.web.app" && uri.port == -1 && uri.userInfo == null &&
        uri.path == "/child-invitation" && uri.rawQuery == null && Regex("[a-f0-9]{64}").matches(uri.rawFragment.orEmpty()))
    val hash = MessageDigest.getInstance("SHA-256").digest(requireNotNull(uri.rawFragment).toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it.toInt() and 255) }
    check(value.childId == target.childId && value.childInstanceId == target.childInstanceId &&
        value.current.status == "pending" && value.current.invitationHash == hash && value.current.expiresAtMillis > now)
}
