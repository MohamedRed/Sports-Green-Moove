package be.sportgreenmoove.app.services

import java.time.Instant
import java.util.Date
import java.util.TimeZone
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class TripDateMappersTest(
    private val deviceZone: String,
    private val departure: String,
    private val expectedDate: String,
    private val expectedTime: String,
) {
    private lateinit var originalZone: TimeZone

    @Before fun setDeviceZone() {
        originalZone = TimeZone.getDefault()
        TimeZone.setDefault(TimeZone.getTimeZone(deviceZone))
    }

    @After fun restoreDeviceZone() { TimeZone.setDefault(originalZone) }

    private fun trip(value: Any) = mapOf(
        "departureAt" to value, "driverUserId" to "driver", "clubId" to "club", "category" to "U8",
        "origin" to mapOf("lat" to 50.7, "lng" to 4.6),
        "destination" to mapOf("lat" to 50.8, "lng" to 4.3),
        "priceCents" to 250, "seatsTotal" to 4, "seatsAvailable" to 2,
    )

    @Test fun tripAndPaymentLabelsUseBelgianDateRegardlessOfDeviceZone() {
        for (value in listOf(departure, Date.from(Instant.parse(departure)))) {
            val summary = mapTrip("trip", trip(value))
            val payable = requireNotNull(mapPayableBooking("booking", mapOf("tripId" to "trip", "seats" to 2), trip(value)))
            assertEquals(expectedDate, summary.dateLabel)
            assertEquals(expectedTime, summary.timeLabel)
            assertEquals(expectedDate, payable.dateLabel)
            assertEquals(expectedTime, payable.timeLabel)
            assertEquals(Instant.parse(departure), Instant.parse(summary.departureAtIso))
            assertEquals(500, payable.amountCents)
        }
    }

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}: {1} -> {2} {3}")
        fun dates(): List<Array<String>> {
            val cases = listOf(
                arrayOf("2026-10-19T11:50:00Z", "LUN 19 OCT", "13h50"),
                arrayOf("2026-01-15T11:50:00Z", "JEU 15 JANV", "12h50"),
                arrayOf("2026-07-01T22:30:00Z", "JEU 02 JUIL", "00h30"),
                arrayOf("2026-12-31T23:30:00Z", "VEN 01 JANV", "00h30"),
                arrayOf("2026-03-29T00:59:00Z", "DIM 29 MARS", "01h59"),
                arrayOf("2026-03-29T01:00:00Z", "DIM 29 MARS", "03h00"),
                arrayOf("2026-10-25T00:59:00Z", "DIM 25 OCT", "02h59"),
                arrayOf("2026-10-25T01:00:00Z", "DIM 25 OCT", "02h00"),
                arrayOf("2026-10-25T00:30:00Z", "DIM 25 OCT", "02h30"),
                arrayOf("2026-10-25T01:30:00Z", "DIM 25 OCT", "02h30"),
            )
            return listOf("UTC", "America/Los_Angeles", "Asia/Tokyo").flatMap { zone ->
                cases.map { arrayOf(zone, *it) }
            }
        }
    }
}
