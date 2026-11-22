# Booking Date Component Review, 3 November 2026

Source `edcd1e98ff53db6a276ce474c8c739aced88f5a4` passes all 24 executed
checks and intentionally skips eight. The main native job passes 345 ordinary
cases (290 passed, 55 skipped), all primary component copies and its independent
connected replay. Disposable-device restoration is independently verified.

All 24 booking-date cases and four measurement regression cases execute and pass.
Requests, trips and payable bookings cover scheduled and unknown dates, both
themes, narrow and wide viewports, and font scale 1.3. Complete text, measured
frame, viewport bounds and actual date foreground contrast pass; the smallest
recorded contrast is 4.637437556587171:1, above the unchanged 4.5:1 requirement.

Review of all original viewports sees complete dates. Every original viewport
matches its original full-window region at every RGBA pixel, with zero tolerance.
Six original viewports are allowlisted as progress-gallery inputs; its existing
JPEG delivery conversion is unchanged. No contact sheet, comparison window, crop,
composited image or partial capture from the first attempt is used.
The payment titles still use the existing ellipsis; the full date wraps separately.
This accepts the date labels, not every other text, amount colour or whole screen.

The earlier twenty reported-paragraph failures remain immutable in
`../booking-date-attempt-2026-11-03/`. Those same twenty cases still report width
overflow in the reconstructed paragraph, but fit their actual measured frames.
The established measured-frame assertion also rejects deliberately height-clipped,
ellipsized and non-wrapping text. This corrects the measurement, not production
layout, capture transport, deadlines or thresholds. No production source changed.

The private original artifact ZIP is 30,275,082 bytes, independently verified as
SHA-256 `1ce710e9ca6119b3fa4d40949b4d16727604f64b6fc2aa8fdfb07a604618c9ae`.
Its 77 selected members are preserved byte for byte. Twelve relevant sources are
bound to both the pushed head and actual merge checkout
`e67ea427900fde177904b76e522bf2c0d5fc395e`; this is not an all-build-input comparison.

Synthetic component views do not prove actual bookings, payments, maps, physical
phones, system insets, screen readers, iOS accessibility or release readiness.
Earlier flow statuses, phone dates, tours and all existing media remain unchanged.
No infrastructure or Terraform change is needed. Existing native/web date-contract
commands and `scripts/qa/**`, portal and evidence triggers cover these additions.

Local publication checks pass all 4,090 Node cases, including 78 focused evidence,
portal and workflow contracts. This verifies the publication changes, not a new
execution of the source-bound native views above.
The complete portal browser suite also passes at 320, 390, 768 and 1440 pixels,
including all six new images, earlier galleries, video playback and deep links.
Desktop/mobile overview and date-gallery screenshots were visually inspected.
