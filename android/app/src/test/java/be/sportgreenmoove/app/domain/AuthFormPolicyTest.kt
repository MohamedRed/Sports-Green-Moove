package be.sportgreenmoove.app.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthFormPolicyTest {
    @Test
    fun loginValidationNormalizesEmailAndPassword() {
        val result = AuthFormPolicy.validate(
            mode = AuthFormMode.Login,
            name = "",
            email = "  TEST@Example.BE ",
            password = "  secret-password  ",
        )

        assertTrue(result is AuthFormValidation.Valid)
        val payload = (result as AuthFormValidation.Valid).payload
        assertEquals("test@example.be", payload.email)
        assertEquals("secret-password", payload.password)
    }

    @Test
    fun signupRequiresNameValidEmailAndStrongPassword() {
        assertEquals(
            "Indiquez votre nom et prénom.",
            (AuthFormPolicy.validate(AuthFormMode.SignUp, "", "test@example.be", "12345678") as AuthFormValidation.Invalid).message,
        )
        assertEquals(
            "Entrez une adresse e-mail valide.",
            (AuthFormPolicy.validate(AuthFormMode.SignUp, "Mohamed", "invalid", "12345678") as AuthFormValidation.Invalid).message,
        )
        assertEquals(
            "Choisissez un mot de passe d'au moins 8 caractères.",
            (AuthFormPolicy.validate(AuthFormMode.SignUp, "Mohamed", "test@example.be", "1234567") as AuthFormValidation.Invalid).message,
        )
    }

    @Test
    fun firebaseCredentialErrorsDoNotLeakRawMessages() {
        val message = AuthFormPolicy.userMessageFor(
            RuntimeException("The supplied auth credential is incorrect, malformed or has expired."),
        )

        assertEquals("E-mail ou mot de passe incorrect.", message)
    }

    @Test
    fun unknownAuthErrorsUseGenericRetryMessage() {
        val message = AuthFormPolicy.userMessageFor(RuntimeException("backend details"))

        assertEquals("Connexion impossible pour le moment. Réessayez dans quelques instants.", message)
    }
}
