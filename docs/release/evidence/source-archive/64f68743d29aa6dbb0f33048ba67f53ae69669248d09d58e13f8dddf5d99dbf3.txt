import Foundation

func checkSearchConsent() {
    var form = SearchFormState.initial(now: Date(timeIntervalSince1970: 1_700_000_000))
    check(!form.guardianConsent && form.childUserId == nil, "Consent must not be preselected")
    form.childUserId = "child-a"
    check(form.validationMessage != nil, "A selected child does not grant consent")
    form.guardianConsent = true
    check(form.validationMessage == nil, "Explicit consent allows valid criteria")
    form.childUserId = "child-a"
    check(form.guardianConsent, "Reconciliation of the same child preserves explicit consent")
    form.childUserId = "child-b"
    check(!form.guardianConsent, "Another child requires new consent")
    form.guardianConsent = true
    form.requireChildTracking = false
    check(!form.guardianConsent, "Changing tracking requires new consent")
    form.guardianConsent = true
    form.requireChildTracking = false
    check(form.guardianConsent, "Unchanged tracking preserves explicit consent")
    form.childUserId = nil
    check(!form.guardianConsent, "Removing the child revokes consent")
    form.guardianConsent = true
    check(form.validationMessage == nil, "An adult search still needs explicit consent")
    form.requireChildTracking = true
    form.guardianConsent = true
    check(form.validationMessage != nil, "Tracking cannot proceed without a child")
    form.childUserId = "child-a"
    form.guardianConsent = true
    let valid = form
    for count in [0, 9] { form = valid; form.seatsNeeded = count; check(form.validationMessage != nil, "Seat count rejected") }
    form = valid; form.baggage = "invalid"; check(form.validationMessage != nil, "Unknown baggage rejected")
    form = valid; form.desiredDepartureAtIso = "not-a-date"; check(form.validationMessage != nil, "Invalid departure rejected")
    form = valid; form.childUserId = " "; form.guardianConsent = true
    check(form.validationMessage != nil, "Blank child identity rejected")

    let origin = ResolvedPlace(placeId: "origin", label: "Origin", formattedAddress: "Isolated origin", lat: 50, lng: 4)
    let destination = ResolvedPlace(placeId: "destination", label: "Destination", formattedAddress: "Isolated destination", lat: 51, lng: 5)
    func context(_ next: SearchFormState = valid, uid: String = "parent-a", reverse: Bool = false) -> SearchRequestContext {
        SearchRequestContext(uid: uid, form: next, origin: reverse ? destination : origin, destination: reverse ? origin : destination)
    }
    let original = context()
    var requests = SearchRequestState()
    check(!requests.permitsBooking(original), "An unsearched match cannot be booked")
    let first = requests.begin(original)!
    check(requests.pending == first && !requests.permitsBooking(original), "Pending search cannot authorise booking")
    requests.invalidate()
    check(!requests.finish(first, uid: "parent-a", succeeded: true), "A revoked response is ignored")
    let second = requests.begin(original)!
    let latest = requests.begin(original)!
    check(!requests.finish(second, uid: "parent-a", succeeded: false), "Old error cannot erase a newer search")
    check(requests.pending == latest, "New search remains pending")
    check(requests.finish(latest, uid: "parent-a", succeeded: true), "Current response accepted")
    check(requests.pending == nil && requests.permitsBooking(original), "Current matching criteria can be booked")

    var changed = valid; changed.seatsNeeded = 2
    check(!requests.permitsBooking(context(changed)), "Seat change invalidates the booking action")
    changed = valid; changed.childUserId = "child-b"; changed.guardianConsent = true
    check(!requests.permitsBooking(context(changed)), "Fresh consent for another child cannot reuse old results")
    changed = valid; changed.guardianConsent = false
    check(!requests.permitsBooking(context(changed)), "Revoked consent cannot reuse old results")
    check(!requests.permitsBooking(context(uid: "parent-b")), "Another account cannot book the result")
    check(!requests.permitsBooking(context(reverse: true)), "Another route cannot reuse the result")
    let foreign = requests.begin(original)!
    check(!requests.finish(foreign, uid: "parent-b", succeeded: true), "Changed account rejects a late response")
    check(requests.pending == nil && !requests.permitsBooking(original), "Foreign response leaves no authority")
    let failed = requests.begin(original)!
    check(requests.finish(failed, uid: "parent-a", succeeded: false), "Current error terminates pending work")
    check(!requests.permitsBooking(original), "A failed search cannot authorise a booking")
    check(requests.begin(context(uid: "")) == nil, "Empty account cannot start a search")
    changed = valid; changed.guardianConsent = false
    check(requests.begin(context(changed)) == nil, "Missing consent prevents a request")
    check(original.criteria.requesterUserId == original.uid && original.criteria.guardianConsent && original.criteria.childUserId == valid.childUserId &&
        original.criteria.seatsNeeded == valid.seatsNeeded, "Callable criteria preserve the exact accepted form")
    print("Search consent checks passed: explicit consent, selection reset, response ordering and booking context")
}
