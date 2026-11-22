import Foundation

func ledgerSummaryChecks() throws {
    let uid = "owner"
    let entry: [String: Any] = ["id": "payout", "type": "payout", "amountCents": -50_000, "createdAtMillis": 1_767_225_600_000]
    let raw: [String: Any] = ["userId": uid, "balanceCents": -22_000, "entries": [entry]]
    let value = try LedgerSummaryWire.rewards(raw, uid: uid)
    check(value.balanceCents == -22_000 && value.progress == 0, "Complete balance must not be recomputed from history")
    check(value.entries[0].amountLabel == "-500,00€" && !value.entries[0].positive, "Debit formatting")
    let impact: [String: Any] = ["userId": uid, "totalCo2Kg": 321.25, "sharedDistanceKm": 257, "rideCount": 257,
        "months": [["month": "2026-01", "co2SavedKg": 1.25]]]
    let total = try LedgerSummaryWire.impact(impact, uid: uid)
    check(total.totalCo2Kg == 321.25 && total.rideCount == 257 && total.sharedDistanceKm == 257, "Complete impact")
    check((try? LedgerSummaryWire.rewards(raw, uid: "foreign")) == nil, "Foreign reward owner")
    check((try? LedgerSummaryWire.impact(impact, uid: "foreign")) == nil, "Foreign impact owner")
    for bad: Any in [0.5, "100", true, 2_147_483_648] {
        var changed = raw; changed["balanceCents"] = bad
        check((try? LedgerSummaryWire.rewards(changed, uid: uid)) == nil, "Malformed money must not become zero")
    }
    var duplicate = raw; duplicate["entries"] = [entry, entry]
    check((try? LedgerSummaryWire.rewards(duplicate, uid: uid)) == nil, "Duplicate history")
    var missing = impact; missing.removeValue(forKey: "totalCo2Kg")
    check((try? LedgerSummaryWire.impact(missing, uid: uid)) == nil, "Missing impact is not zero")
    var minimum = raw; minimum["entries"] = [entry.merging(["amountCents": Int(Int32.min)]) { _, value in value }]
    let minimumValue = try LedgerSummaryWire.rewards(minimum, uid: uid)
    check(minimumValue.entries[0].amountLabel == "-21474836,48€", "Minimum signed cents formatting")
    print("Ledger summary wire checks passed; no iOS UI or provider integration implied.")
}
