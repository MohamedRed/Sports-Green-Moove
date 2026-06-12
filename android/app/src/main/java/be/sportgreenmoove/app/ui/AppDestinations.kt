package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole

fun DemoScreen.toTopLevel(): DemoScreen =
    when (this) {
        DemoScreen.Search -> DemoScreen.Home
        DemoScreen.Ride -> DemoScreen.Trips
        in profileChildScreens -> DemoScreen.Profile
        else -> this
    }

private val profileChildScreens = setOf(
    DemoScreen.Groups,
    DemoScreen.Impact,
    DemoScreen.Rewards,
    DemoScreen.Options,
    DemoScreen.Payments,
)

fun roleLabel(role: AppRole): String =
    when (role) {
        AppRole.Parent -> "Parent"
        AppRole.Driver -> "Conducteur"
        AppRole.Child -> "Enfant"
        AppRole.ClubManager -> "Club manager"
        AppRole.Admin -> "Admin"
    }

enum class DemoScreen {
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
