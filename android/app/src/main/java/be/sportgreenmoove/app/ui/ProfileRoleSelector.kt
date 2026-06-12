package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import be.sportgreenmoove.app.data.AppRole

@Composable
fun ProfileRoleSelector(role: AppRole, onRoleChange: (AppRole) -> Unit) {
    Column(
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            V2Chip("Parent", selected = role == AppRole.Parent, onClick = { onRoleChange(AppRole.Parent) }, modifier = Modifier.weight(1f))
            V2Chip("Conducteur", selected = role == AppRole.Driver, onClick = { onRoleChange(AppRole.Driver) }, modifier = Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            V2Chip("Enfant", selected = role == AppRole.Child, onClick = { onRoleChange(AppRole.Child) }, modifier = Modifier.weight(1f))
            V2Chip("Club manager", selected = role == AppRole.ClubManager, onClick = { onRoleChange(AppRole.ClubManager) }, modifier = Modifier.weight(1f))
        }
    }
}
