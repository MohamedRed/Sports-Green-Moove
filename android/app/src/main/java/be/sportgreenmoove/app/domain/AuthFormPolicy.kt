package be.sportgreenmoove.app.domain

import java.util.Locale

enum class AuthFormMode {
    Login,
    SignUp,
}

data class AuthFormPayload(
    val name: String,
    val email: String,
    val password: String,
)

sealed interface AuthFormValidation {
    data class Valid(val payload: AuthFormPayload) : AuthFormValidation
    data class Invalid(val message: String) : AuthFormValidation
}

object AuthFormPolicy {
    private val emailRegex = Regex("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", RegexOption.IGNORE_CASE)

    fun validate(mode: AuthFormMode, name: String, email: String, password: String): AuthFormValidation {
        val normalizedName = name.trim()
        val normalizedEmail = email.trim().lowercase(Locale.ROOT)
        val normalizedPassword = password.trim()

        return when {
            mode == AuthFormMode.SignUp && normalizedName.length < 2 ->
                AuthFormValidation.Invalid("Indiquez votre nom et prénom.")
            normalizedEmail.isBlank() ->
                AuthFormValidation.Invalid("Entrez votre adresse e-mail.")
            !emailRegex.matches(normalizedEmail) ->
                AuthFormValidation.Invalid("Entrez une adresse e-mail valide.")
            normalizedPassword.isBlank() ->
                AuthFormValidation.Invalid("Entrez votre mot de passe.")
            mode == AuthFormMode.SignUp && normalizedPassword.length < 8 ->
                AuthFormValidation.Invalid("Choisissez un mot de passe d'au moins 8 caractères.")
            else -> AuthFormValidation.Valid(
                AuthFormPayload(
                    name = normalizedName,
                    email = normalizedEmail,
                    password = normalizedPassword,
                ),
            )
        }
    }

    fun userMessageFor(error: Throwable): String {
        val className = error.javaClass.simpleName
        val message = error.message.orEmpty()
        val normalizedMessage = message.lowercase(Locale.ROOT)

        return when {
            className.contains("Network", ignoreCase = true) ||
                normalizedMessage.contains("network") ||
                normalizedMessage.contains("interrupted") ->
                "Connexion réseau indisponible. Vérifiez votre connexion puis réessayez."
            className.contains("UserCollision", ignoreCase = true) ||
                normalizedMessage.contains("already in use") ||
                normalizedMessage.contains("already exists") ->
                "Un compte existe déjà avec cette adresse e-mail."
            className.contains("WeakPassword", ignoreCase = true) ||
                normalizedMessage.contains("password is invalid") && normalizedMessage.contains("least 6") ->
                "Choisissez un mot de passe plus sécurisé."
            className.contains("InvalidCredentials", ignoreCase = true) ||
                className.contains("InvalidUser", ignoreCase = true) ||
                normalizedMessage.contains("supplied auth credential") ||
                normalizedMessage.contains("password is invalid") ||
                normalizedMessage.contains("no user record") ->
                "E-mail ou mot de passe incorrect."
            normalizedMessage.contains("badly formatted") ||
                normalizedMessage.contains("invalid email") ->
                "Entrez une adresse e-mail valide."
            normalizedMessage.contains("operation is not allowed") ->
                "La connexion par e-mail est indisponible pour le moment."
            className.contains("TooManyRequests", ignoreCase = true) ||
                normalizedMessage.contains("too many") ->
                "Trop de tentatives. Patientez quelques minutes puis réessayez."
            className.contains("ProviderConfigurationException", ignoreCase = true) ->
                "Service d'authentification indisponible. Contactez le support SPORTS GREEN-mOOVe."
            else ->
                "Connexion impossible pour le moment. Réessayez dans quelques instants."
        }
    }
}
