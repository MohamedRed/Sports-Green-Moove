package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AppRole

private val mobileSelectableRoles = listOf(
    AppRole.Parent,
    AppRole.Driver,
    AppRole.Child,
    AppRole.ClubManager,
    AppRole.Admin,
)

@Composable
fun ProfileRoleSelector(
    role: AppRole,
    availableRoles: Set<AppRole>,
    onRoleChange: (AppRole) -> Unit,
) {
    val roles = mobileSelectableRoles.filter { it in availableRoles }.ifEmpty { listOf(AppRole.Parent) }
    Column(
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        roles.chunked(2).forEach { rowRoles ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                rowRoles.forEach { option ->
                    V2Chip(
                        roleLabel(option),
                        selected = role == option,
                        onClick = { onRoleChange(option) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
