package be.sportgreenmoove.app.ui

import android.content.Intent

// ActivityScenario matches lifecycle events by intent filters, not just the component.
// Preserve those filters without replaying task-clearing flags from the first launch.
internal fun returnToForegroundIntent(launchIntent: Intent): Intent =
    Intent(launchIntent).setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
