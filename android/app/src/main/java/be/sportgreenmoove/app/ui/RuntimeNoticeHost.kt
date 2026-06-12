package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun RuntimeNoticeHost(
    notice: String?,
    error: String?,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val message = notice ?: error ?: return
    RuntimeNotice(
        message = message,
        warning = error != null,
        onDismiss = onDismiss,
        modifier = modifier,
    )
}
