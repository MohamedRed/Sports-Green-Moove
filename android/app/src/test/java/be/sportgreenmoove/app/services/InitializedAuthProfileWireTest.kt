package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.AppRole
import be.sportgreenmoove.app.data.claimKey
import org.junit.Assert.*
import org.junit.Test

class InitializedAuthProfileWireTest {
    private fun profile(vararg roles: AppRole): Map<String, Any> = mapOf("userId" to "account",
        "roleKeys" to roles.map { it.claimKey }, "roles" to AppRole.entries.associate { it.claimKey to (it in roles) })
    private fun denied(value: Map<*, *>?) { assertThrows(IllegalStateException::class.java) { InitializedAuthProfileWire.roles("account", value) } }
    @Test fun aChildRemainsAChildWithoutAnAdultDefault() {
        assertEquals(setOf(AppRole.Child), InitializedAuthProfileWire.roles("account", profile(AppRole.Child)))
    }
    @Test fun everySupportedAdultRoleAndLegitimateAdultCombinationIsPreserved() {
        for (role in AppRole.entries.filter { it != AppRole.Child })
            assertEquals(setOf(role), InitializedAuthProfileWire.roles("account", profile(role)))
        assertEquals(setOf(AppRole.Parent, AppRole.Driver), InitializedAuthProfileWire.roles("account", profile(AppRole.Parent, AppRole.Driver)))
    }
    @Test fun missingOrUnrelatedAccountProfilesAreRejected() {
        denied(null); denied(emptyMap<String, Any>()); denied(profile(AppRole.Parent) + ("userId" to "other-account"))
    }
    @Test fun missingEmptyUnknownDuplicatedOrNonStringRolesCannotBecomeParent() {
        val original = profile(AppRole.Child)
        denied(original - "roleKeys")
        for (value in listOf(emptyList<Any>(), listOf("unknown"), listOf("child", "child"), listOf(42)))
            denied(original + ("roleKeys" to value))
    }
    @Test fun childAndAdultRoleCombinationsAreRejectedRatherThanPartiallyParsed() {
        for (adult in AppRole.entries.filter { it != AppRole.Child }) denied(profile(AppRole.Child, adult))
    }
    @Test fun missingContradictoryAndUnrecognizedRoleFlagsCannotOverrideTheRoleList() {
        val child = profile(AppRole.Child); denied(child - "roles")
        denied(child + ("roles" to mapOf("child" to true)))
        denied(child + ("roles" to AppRole.entries.associate { it.claimKey to false }))
        denied(child + ("roles" to (AppRole.entries.associate { it.claimKey to (it == AppRole.Child) } + ("unknown" to true))))
    }
}
