package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.appRoleFromClaim
import be.sportgreenmoove.app.data.claimKey

internal object InitializedAuthProfileWire {
    fun roles(uid: String, profile: Map<*, *>?): Set<AppRole> {
        val data = checkNotNull(profile) { "Missing initialized account profile" }
        check(uid.isNotBlank() && data["userId"] == uid) { "Invalid initialized account identity" }
        val keys = data["roleKeys"] as? List<*> ?: error("Missing initialized account roles")
        check(keys.isNotEmpty() && keys.size == keys.distinct().size) { "Invalid initialized account roles" }
        val roles = keys.map { key ->
            appRoleFromClaim(key as? String ?: error("Invalid role type")) ?: error("Unknown initialized account role")
        }.toSet()
        check(AppRole.Child !in roles || roles.size == 1) { "A child account cannot have an adult role" }
        val flags = data["roles"] as? Map<*, *> ?: error("Missing initialized account role flags")
        check(flags.keys == AppRole.entries.map { it.claimKey }.toSet() &&
            AppRole.entries.all { flags[it.claimKey] == (it in roles) }) { "Inconsistent initialized account roles" }
        return roles
    }
}
