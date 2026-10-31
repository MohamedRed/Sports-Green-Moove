package be.sportgreenmoove.app.data

import java.text.Normalizer

fun normalizedProfileCity(value: String): String? {
    if (value.length > 100 || value.any { it.code in 0..31 || it.code in 127..159 ||
            it.code in 0x200b..0x200f || it.code in 0x2028..0x202e || it.code in 0x2060..0x206f || it.code == 0xfeff }) return null
    return Normalizer.normalize(value.trim(), Normalizer.Form.NFC).takeIf { it.length in 1..100 }
}
data class ProfileCity(val userId: String, val city: String?, val revision: Long) {
    init {
        require(userId.isNotBlank() && revision in 0..9_007_199_254_740_991L)
        require(city == null || normalizedProfileCity(city) == city)
        require(revision > 0 || city == null)
    }
}
data class ProfileCityChange(val city: String?, val expectedRevision: Long, val requestId: String)
