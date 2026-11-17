package be.sportgreenmoove.app.services

import android.content.Intent
import com.facebook.CallbackManager
import java.util.concurrent.CopyOnWriteArrayList

object FacebookActivityResultBridge {
    private val callbackManagers = CopyOnWriteArrayList<CallbackManager>()

    fun register(callbackManager: CallbackManager): AutoCloseable {
        callbackManagers.add(callbackManager)
        return AutoCloseable { callbackManagers.remove(callbackManager) }
    }

    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean =
        callbackManagers.any { it.onActivityResult(requestCode, resultCode, data) }
}
