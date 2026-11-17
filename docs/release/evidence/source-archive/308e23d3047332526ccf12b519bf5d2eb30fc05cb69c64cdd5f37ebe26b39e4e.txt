package be.sportgreenmoove.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.data.ChildSummary
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType

@Composable
fun SearchChildSelector(
    children: List<ChildSummary>,
    selectedChildId: String?,
    onSelectedChild: (String?) -> Unit,
) {
    if (children.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "ENFANT",
            style = SgmType.Eyebrow.copy(
                color = Sgm.colors.textMuted,
                fontSize = 11.sp,
                letterSpacing = 0.14.em,
            ),
        )
        val options: List<ChildOption> = children.map { ChildOption.Child(it) } + ChildOption.None
        options.chunked(2).forEach { rowOptions ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                rowOptions.forEach { option ->
                    V2Chip(
                        text = option.label,
                        selected = option.isSelected(selectedChildId),
                        onClick = { onSelectedChild(option.childId) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (rowOptions.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
        Text(
            selectedChildLabel(children, selectedChildId),
            style = SgmType.BodyXS.copy(
                color = SgmColor.Green,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
    }
}

private fun selectedChildLabel(children: List<ChildSummary>, selectedChildId: String?): String {
    val child = children.firstOrNull { it.id == selectedChildId }
    return child?.teamLabel ?: "Aucun enfant attaché à la demande"
}

private sealed interface ChildOption {
    val childId: String?
    val label: String

    fun isSelected(selectedChildId: String?): Boolean = childId == selectedChildId

    data class Child(val child: ChildSummary) : ChildOption {
        override val childId: String = child.id
        override val label: String = child.label
    }

    data object None : ChildOption {
        override val childId: String? = null
        override val label: String = "Aucun"
    }
}
