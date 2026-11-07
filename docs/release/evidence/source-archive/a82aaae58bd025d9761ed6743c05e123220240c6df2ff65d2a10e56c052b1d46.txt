package be.sportgreenmoove.app.data

sealed interface EmergencyContactTarget {
    data object Self : EmergencyContactTarget
    data class Child(val childId: String, val clubId: String) : EmergencyContactTarget
}

private val emergencyPhonePattern = Regex("\\+[1-9][0-9]{7,14}")
fun isEmergencyPhone(value: String) = emergencyPhonePattern.matches(value)

data class PersonalEmergencyContact(val name: String, val phone: String) {
    init {
        require(name == name.trim() && name.isNotEmpty() && name.length <= 100)
        require(!Regex("[\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]").containsMatchIn(name))
        require(isEmergencyPhone(phone))
    }
}
data class EmergencyContactView(val ownerUid: String, val target: EmergencyContactTarget,
    val contact: PersonalEmergencyContact?, val revision: Long, val childName: String? = null, val clubName: String? = null,
    val childInstanceId: String? = null)
data class EmergencyContactOperation(val target: EmergencyContactTarget, val contact: PersonalEmergencyContact?,
    val expectedRevision: Long, val requestId: String, val expectedChildInstanceId: String? = null)
data class EmergencyContactReceipt(val revision: Long)
enum class EmergencyDialerResult { Opened, Unavailable, Denied, Cancelled }
