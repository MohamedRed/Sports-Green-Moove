package be.sportgreenmoove.app.ui

import be.sportgreenmoove.app.data.AppRole
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionRoleSelectionTest {
    @Test
    fun preferredMobileRole_prefersDriverWhenUserHasParentAndDriverRoles() {
        val selected = setOf(AppRole.Parent, AppRole.Driver).preferredMobileRole()

        assertEquals(AppRole.Driver, selected)
    }

    @Test
    fun activeMobileRole_switchesToDriverWhenNewSessionHasParentAndDriverRoles() {
        val selected = selectActiveMobileRole(
            currentRole = AppRole.Parent,
            availableRoles = setOf(AppRole.Parent, AppRole.Driver),
            sessionChanged = true,
        )

        assertEquals(AppRole.Driver, selected)
    }

    @Test
    fun activeMobileRole_keepsManualRoleWhenSameSessionStillAllowsIt() {
        val selected = selectActiveMobileRole(
            currentRole = AppRole.Parent,
            availableRoles = setOf(AppRole.Parent, AppRole.Driver),
            sessionChanged = false,
        )

        assertEquals(AppRole.Parent, selected)
    }

    @Test
    fun activeMobileRole_replacesUnavailableRoleOnSameSession() {
        val selected = selectActiveMobileRole(
            currentRole = AppRole.Parent,
            availableRoles = setOf(AppRole.Driver),
            sessionChanged = false,
        )

        assertEquals(AppRole.Driver, selected)
    }
}
