package be.sportgreenmoove.app.ui

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI

internal fun verifySearchBookingCheckpoint(session: JSONObject, tripId: String, bookingId: String, phase: String) {
    check(phase in listOf("requested", "approved", "cancelled"))
    val port = session.getInt("searchBookingCheckpointPort").also { check(it in 1024..65535) }
    val token = session.getString("searchBookingCheckpointToken").also { check(it.matches(Regex("[a-f0-9]{64}"))) }
    val connection = URI("http://10.0.2.2:$port/checkpoint").toURL().openConnection() as HttpURLConnection
    try {
        connection.requestMethod = "POST"
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 30_000
        connection.readTimeout = 30_000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $token")
        val body = JSONObject().put("phase", phase).put("runId", session.getString("runId"))
            .put("tripId", tripId).put("bookingId", bookingId).toString()
        connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        check(connection.responseCode == 200) { "Independent booking checkpoint failed: $phase" }
        val result = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        check(result.getBoolean("accepted") && result.getString("phase") == phase)
    } finally { connection.disconnect() }
}
