import Foundation

func checkTripDateLabels() {
    let cases = [
        ("2026-10-19T11:50:00Z", "LUN 19 OCT", "13h50"),
        ("2026-01-15T11:50:00Z", "JEU 15 JANV", "12h50"),
        ("2026-07-01T22:30:00Z", "JEU 02 JUIL", "00h30"),
        ("2026-12-31T23:30:00Z", "VEN 01 JANV", "00h30"),
        ("2026-03-29T00:59:00Z", "DIM 29 MARS", "01h59"),
        ("2026-03-29T01:00:00Z", "DIM 29 MARS", "03h00"),
        ("2026-10-25T00:59:00Z", "DIM 25 OCT", "02h59"),
        ("2026-10-25T01:00:00Z", "DIM 25 OCT", "02h00"),
        ("2026-10-25T00:30:00Z", "DIM 25 OCT", "02h30"),
        ("2026-10-25T01:30:00Z", "DIM 25 OCT", "02h30"),
    ]
    let original = NSTimeZone.default
    defer { NSTimeZone.default = original }
    for zone in ["UTC", "America/Los_Angeles", "Asia/Tokyo"] {
        NSTimeZone.default = TimeZone(identifier: zone)!
        for (iso, expectedDate, expectedTime) in cases {
            let date = ISO8601DateFormatter().date(from: iso)!
            check(tripDateLabel(date) == expectedDate, "Belgian trip date in \(zone): \(iso)")
            check(tripTimeLabel(date) == expectedTime, "Belgian trip time in \(zone): \(iso)")
        }
    }
    print("TripDateLabelChecks passed: 30 date/time pairs across 3 device timezones")
}
