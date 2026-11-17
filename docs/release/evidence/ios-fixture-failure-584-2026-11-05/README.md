# iPhone Fixture Result At 584c61b

Run 42085479023, job 127462307445, compiles the SDK-linked application and all
bundles successfully. All eleven synthetic screen cases execute: eight pass and
three fail, with five assertion failures. The fixture step exits with code 65;
the whole job is subsequently cancelled at its approved 50-minute deadline.
Disposal succeeds and the artifact inventory is empty. Do not reduce the actual
screen failures to a build timeout or accept this as a complete native gate.

- The personal-contact case saves, reopens and removes the contact, then a downward
  swipe leaves it on the options screen before its explicit Back tap. Clean sheet
  dismissal is legitimate app behavior. The candidate scrolls the named contact
  surface only if its Back target is not hittable, then still requires Back and
  the destination screen. Every original save/removal/reopen assertion remains.
- The second-child/two-seat request has no observed confirmation alert. Its cause
  is unknown. The actual fixture gateway and AppState dispatch produce the exact
  confirmation locally. The existing screen helper now also asserts button
  enablement/hittability and prints bounded synthetic accessibility state when
  the alert is absent. The expected alert, text, OK action and six-second waits
  remain unchanged; no additional capture or successful UI claim is added.
- The publication form remains on the address step with its real validation
  alert. The fixture set places before switching to driver, whose required
  account-scope reset correctly clears them. A local execution reproduces that
  missing-place failure. The candidate establishes its final role before seeding
  private data. It does not weaken production account clearing or invent places.

The native logic runner now compiles the actual DEBUG fixture factory and all of
its protocol extensions. Thirteen route owners and the real fixture search/booking
dispatch are checked alongside every previous native check. A route-injection
overload permits selecting the negative fixture without changing its original
seed order. Full local logic and signature checks pass. They are not a simulator,
SDK or real-provider test. There are no new UI cases, retries, reduced assertions,
longer deadlines, captures, DNS changes, notification-policy changes or cloud writes.

Current release SDK/UI entries stay pending. Historical reports/media/flow statuses,
dates, tours and blockers remain immutable. Publish one short eight-of-eleven note
without new media or internal technology names. Existing Web Integration Smoke
runs the expanded retained-result and input-preservation tests. Terraform is not
applicable to this fixture preparation and diagnostic work.
