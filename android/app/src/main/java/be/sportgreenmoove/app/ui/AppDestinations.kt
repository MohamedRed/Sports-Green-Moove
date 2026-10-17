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
    AppScreen.Impact,
    AppScreen.Rewards,
    AppScreen.Options,
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

enum class AppScreen {
    Home,
    Trips,
    Publish,
    Messages,
    Profile,
    Search,
    Groups,
    Impact,
    Rewards,
    Options,
    Payments,
    Ride,
}
