package be.sportgreenmoove.app.ui

internal fun finishPrimaryCaptureObservation(awaitTermination: () -> Boolean, persist: (Boolean) -> Unit) {
    var terminated = false
    var failure: Throwable? = null
    try {
        terminated = awaitTermination()
        check(terminated) { "Capture observer did not stop" }
    } catch (error: Throwable) { failure = error }
    try { persist(terminated) }
    catch (error: Throwable) {
        if (failure == null) failure = error
        else if (failure !== error) failure.addSuppressed(error)
    }
    failure?.let { throw it }
}
