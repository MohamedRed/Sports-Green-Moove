# Booking Date Layout Checks

The ordinary Android component suite includes 24 date cases: request cards, trip
cards and payable bookings; scheduled dates and the existing unknown-date state;
light and dark themes; narrow and wide viewports with font scale 1.3.

Each case uses the production composable and synthetic fixtures. It checks the
complete date's text layout, visible viewport bounds and actual foreground's
contrast against that component's background, with a minimum ratio of 4.5:1.
No production layout or colour is changed merely to prepare these tests.

After those assertions pass, it captures one original viewport, one original
window and a hash-bound JSON marker. Primary collection requires all 72 files in
`sgm-booking-dates`. Failed ordinary execution keeps partial files separate; it
does not accept a later alternate copy or missing case.

Compilation and Node contract checks are preparation, not rendered acceptance.
Review actual completed native reports and original images before changing the
partner site's date requirement or adding public media. This suite is not a real
booking, payment, map, device-orientation or physical accessibility trial. No new
provider request, infrastructure resource, fallback or Terraform change is added.

Local preparation on 3 November: Android test compilation succeeds; 185 focused
contracts and the complete 4,085-case Node suite pass. The first integration run
retains 14 failures: the shell harness lacked the 72 new synthetic artifacts and
the historical workload guards had not separated the one declared added step.
The fixture is extended with 72 missing-file cases and a failed-primary-copy case;
the original assertions and 111-step / 153-step fingerprints remain unchanged.
These local results do not accept any of the 24 rendered date cases yet.

The first native execution rejects twenty cases at the original reported-paragraph
overflow check and passes four narrow payment views. Preserve its original bundle
in `docs/release/evidence/booking-date-attempt-2026-11-03/`. The follow-up uses the
already established measured-frame helper, records both reported and measured
dimensions, and adds explicit vertical, ellipsis and non-wrapping rejection cases.
This is a test-measurement candidate, not a production layout correction or proof
that the rejected dates already fit. Its new native replay is still required.

Follow-up: source edcd1e9 completes its native replay with 345 ordinary cases
(290 passed, 55 skipped), all primary copies and the independent connected replay
passing. All 24 date views and four measurement probes pass; every original
viewport matches its window region exactly and visual review sees complete dates.
The twenty reported width flags remain, confirming why that proxy was unsuitable
for these actual measured frames. Preserve the first attempt above unchanged;
the separate reviewed bundle is `docs/release/evidence/booking-date-visual-2026-11-03/`.
These are simulated component views, not transaction or physical-release proof.
