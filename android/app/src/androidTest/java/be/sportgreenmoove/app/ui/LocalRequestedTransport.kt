package be.sportgreenmoove.app.ui

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import java.io.Closeable
import java.util.concurrent.atomic.AtomicInteger

internal class LocalRequestedTransport(private val connectivity: ConnectivityManager, private val transport: Int) : Closeable {
    private val available = AtomicInteger()
    private val lost = AtomicInteger()
    private val unavailable = AtomicInteger()
    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { available.incrementAndGet() }
        override fun onLost(network: Network) { lost.incrementAndGet() }
        override fun onUnavailable() { unavailable.incrementAndGet() }
    }
    var registered = false
        private set
    val availableCount get() = available.get()
    val lostCount get() = lost.get()
    val unavailableCount get() = unavailable.get()

    fun start() {
        check(!registered)
        val request = NetworkRequest.Builder().addTransportType(transport)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build()
        connectivity.requestNetwork(request, callback)
        registered = true
    }

    override fun close() {
        if (!registered) return
        connectivity.unregisterNetworkCallback(callback)
        registered = false
    }
}

internal fun finishLocalNetworkCleanup(primary: Throwable?, vararg actions: () -> Unit) {
    var failure = primary
    for (action in actions) {
        try { action() }
        catch (error: Throwable) {
            if (failure == null) failure = error else if (failure !== error) failure.addSuppressed(error)
        }
    }
    failure?.let { throw it }
}
