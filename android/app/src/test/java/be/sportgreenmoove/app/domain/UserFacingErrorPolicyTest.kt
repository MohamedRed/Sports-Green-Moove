package be.sportgreenmoove.app.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class UserFacingErrorPolicyTest {
    @Test
    fun mapsMissingParentRoleToActionableMessage() {
        val message = UserFacingErrorPolicy.messageFor(RuntimeException("PERMISSION_DENIED: parent role is required."))

        assertEquals("Votre profil parent doit être activé avant cette action.", message)
    }

    @Test
    fun mapsDriverVerificationPrecondition() {
        val message = UserFacingErrorPolicy.messageFor(RuntimeException("FAILED_PRECONDITION: Driver verification is required before publishing trips."))

        assertEquals("La vérification conducteur est requise avant de publier un trajet.", message)
    }

    @Test
    fun mapsUnknownFailuresToGenericRetry() {
        val message = UserFacingErrorPolicy.messageFor(RuntimeException("internal backend detail"))

        assertEquals("Action impossible pour le moment. Réessayez dans quelques instants.", message)
    }
}
