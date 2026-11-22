package be.sportgreenmoove.app.data

fun isActiveClubMembership(status: String?, active: Boolean?): Boolean =
    (status == "active" && active != false) || (status == null && active == true)
