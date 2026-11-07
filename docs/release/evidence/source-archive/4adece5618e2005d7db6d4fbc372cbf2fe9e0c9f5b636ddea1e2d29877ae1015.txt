package be.sportgreenmoove.app.ui

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import java.time.LocalTime

internal fun enterNativePickerTime(time: LocalTime) {
    val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    fun control(id: String) = requireNotNull(device.wait(Until.findObject(By.res("android", id)), 15_000)) {
        "The configured Android time picker did not expose $id"
    }
    control("toggle_mode").click()
    val hour = control("input_hour")
    hour.click()
    hour.text = time.hour.toString()
    check(hour.text.toInt() == time.hour)
    val minute = control("input_minute")
    minute.click()
    minute.text = time.minute.toString()
    check(minute.text.toInt() == time.minute)
    control("button1").click()
    check(device.wait(Until.gone(By.res("android", "input_minute")), 15_000)) {
        "The time picker did not accept the entered time"
    }
}
