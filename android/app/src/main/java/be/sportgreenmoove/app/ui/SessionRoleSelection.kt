package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole

fun Set<AppRole>.preferredMobileRole(): AppRole =
    AppRole.entries.firstOrNull { it in this } ?: AppRole.Parent
