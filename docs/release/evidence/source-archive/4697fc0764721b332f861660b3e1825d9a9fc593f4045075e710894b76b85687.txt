package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.ChildSummary

internal fun mapChild(id: String, data: Map<String, Any>): ChildSummary {
    val label = stringValue(data["displayName"])
        ?: stringValue(data["name"])
        ?: stringValue(data["firstName"])
        ?: "Enfant ${id.takeLast(4).uppercase()}"
    val teamLabel = stringValue(data["teamName"])
        ?: stringValue(data["category"])
        ?: stringValue(data["clubName"])
        ?: "Équipe à confirmer"
    return ChildSummary(
        id = id,
        label = label,
        teamLabel = teamLabel,
        trackingEnabled = data["trackingConsent"] == true || data["trackingEnabled"] == true,
    )
}

private fun stringValue(value: Any?): String? =
    (value as? String)?.trim()?.takeIf(String::isNotEmpty)
