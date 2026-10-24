package be.sportgreenmoove.app.services

import be.sportgreenmoove.app.data.*

internal object EmergencyContactWire {
    private fun map(value: Any?) = value as? Map<*, *> ?: error("Réponse de contact invalide.")
    private fun revision(value: Any?): Long {
        val number = (value as? Number)?.toDouble() ?: error("Version du contact manquante.")
        check(number.isFinite() && number % 1.0 == 0.0 && number in 0.0..9_007_199_254_740_991.0)
        return number.toLong()
    }
    fun target(value: EmergencyContactTarget): Map<String, Any> = when (value) {
        EmergencyContactTarget.Self -> mapOf("kind" to "self")
        is EmergencyContactTarget.Child -> mapOf("kind" to "child", "childId" to TripChangeWire.id(value.childId),
            "clubId" to TripChangeWire.id(value.clubId))
    }
    private fun validateScope(value: Map<*, *>, uid: String, target: EmergencyContactTarget) {
        val expectedKind = if (target is EmergencyContactTarget.Child) "child" else "self"
        check(value["kind"] == expectedKind && value["subjectId"] == if (target is EmergencyContactTarget.Child) target.childId else uid)
        if (target is EmergencyContactTarget.Child) {
            check(value["clubId"] == target.clubId); instance(value["childInstanceId"])
        } else check(listOf("childInstanceId", "clubId", "childName", "clubName").none(value::containsKey))
    }
    private fun instance(value: Any?): String = (value as? String)?.also { check(Regex("[a-f0-9]{64}").matches(it)) }
        ?: error("Identité du profil enfant manquante.")
    private fun label(value: Any?): String = (value as? String)?.also {
        check(it == it.trim() && it.isNotEmpty() && it.length <= 120 &&
            !Regex("[\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]").containsMatchIn(it))
    } ?: error("Nom du profil manquant.")
    fun view(value: Any?, uid: String, target: EmergencyContactTarget): EmergencyContactView = map(value).let {
        validateScope(it, uid, target); check(it.containsKey("contact"))
        val contact = it["contact"]?.let { raw -> map(raw).let { fields ->
            PersonalEmergencyContact(fields["name"] as? String ?: error("Nom du contact manquant."),
                fields["phone"] as? String ?: error("Numéro du contact manquant."))
        } }
        val version = revision(it["revision"]); check(contact == null || version > 0)
        if (target is EmergencyContactTarget.Child) EmergencyContactView(uid, target, contact, version,
            label(it["childName"]), label(it["clubName"]), instance(it["childInstanceId"]))
        else EmergencyContactView(uid, target, contact, version)
    }
    fun payload(operation: EmergencyContactOperation): Map<String, Any?> {
        check(operation.expectedRevision in 0..9_007_199_254_740_990L)
        val childIdentity = if (operation.target is EmergencyContactTarget.Child)
            mapOf("expectedChildInstanceId" to instance(operation.expectedChildInstanceId))
        else { check(operation.expectedChildInstanceId == null); emptyMap() }
        return mapOf("target" to target(operation.target), "expectedRevision" to operation.expectedRevision,
            "requestId" to TripChangeWire.uuid(operation.requestId), "contact" to operation.contact?.let {
                mapOf("name" to it.name, "phone" to it.phone)
            }) + childIdentity
    }
    fun receipt(value: Any?, uid: String, operation: EmergencyContactOperation): EmergencyContactReceipt = map(value).let {
        validateScope(it, uid, operation.target); check(it["replayed"] is Boolean)
        if (operation.target is EmergencyContactTarget.Child) check(instance(it["childInstanceId"]) == instance(operation.expectedChildInstanceId))
        val version = revision(it["revision"]); check(version > operation.expectedRevision)
        EmergencyContactReceipt(version)
    }
}
