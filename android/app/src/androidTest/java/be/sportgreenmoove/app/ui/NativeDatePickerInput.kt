package be.sportgreenmoove.app.ui

import android.text.format.DateFormat
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.temporal.ChronoUnit

internal fun enterNativePickerDate(from: LocalDate, target: LocalDate, confirm: Boolean = true) {
    val distance = ChronoUnit.MONTHS.between(YearMonth.from(from), YearMonth.from(target))
    require(distance in -1L..1L) { "Schedule fixtures must stay within adjacent calendar months" }
    val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    fun control(id: String) = requireNotNull(device.wait(Until.findObject(By.res("android", id)), 15_000)) {
        "The configured Android date picker did not expose $id"
    }
    control("day_picker_view_pager")
    if (distance != 0L) control(if (distance > 0) "next" else "prev").click()
    val label = DateFormat.format("dd MMMM yyyy", target.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()).toString()
    val day = requireNotNull(device.wait(Until.findObject(By.desc(label)), 15_000)) {
        "The requested day was not available in the native date picker"
    }
    check(day.isEnabled)
    day.click()
    control(if (confirm) "button1" else "button2").click()
    check(device.wait(Until.gone(By.res("android", "day_picker_view_pager")), 15_000)) {
        "The date picker did not close after the selected action"
    }
}
