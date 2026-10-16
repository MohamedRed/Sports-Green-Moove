package be.sportgreenmoove.app.ui

import androidx.compose.ui.test.junit4.createEmptyComposeRule
import kotlinx.coroutines.test.StandardTestDispatcher

// SDK tasks resume on callback threads; queue test composition effects instead
// of letting the default unconfined dispatcher apply views on those threads.
internal fun createLocalAppComposeRule() =
    createEmptyComposeRule(effectContext = StandardTestDispatcher())
