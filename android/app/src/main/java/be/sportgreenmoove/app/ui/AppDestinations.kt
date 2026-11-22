package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole

fun AppScreen.toTopLevel(): AppScreen =
    when (this) {
        AppScreen.Search -> AppScreen.Home
        AppScreen.Ride -> AppScreen.Trips
        in profileChildScreens -> AppScreen.Profile
        else -> this
    }

private val profileChildScreens = setOf(
    AppScreen.Groups,
    AppScreen.Guardians,
    AppScreen.TeamEnrollments,
    AppScreen.Impact,
    AppScreen.Rewards,
    AppScreen.Options,
    AppScreen.Support,
    AppScreen.EmergencyContacts,
    AppScreen.Payments,
)

fun roleLabel(role: AppRole): String =
    when (role) {
        AppRole.Parent -> "Parent"
        AppRole.Driver -> "Conducteur"
        AppRole.Child -> "Enfant"
        AppRole.ClubManager -> "Club manager"
        AppRole.Admin -> "Admin"
    }

internal fun canManageTeamEnrollment(roles: Set<AppRole>) = AppRole.Child !in roles &&
    roles.any { it in setOf(AppRole.Parent, AppRole.Driver, AppRole.ClubManager) }

enum class AppScreen {
    Home,
    Trips,
    Publish,
    Messages,
    Profile,
    Search,
    Groups,
    Guardians,
    TeamEnrollments,
    Impact,
    Rewards,
    Options,
    Support,
    EmergencyContacts,
    Payments,
    Ride,
}
