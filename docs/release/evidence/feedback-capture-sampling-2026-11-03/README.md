# Feedback Capture Sampling

Offline inspection of the unchanged, previously retained input diagnostics finds
30 distinct colours on the narrow 16-pixel grid but only 14 on the wide grid.
The visibly populated wide images therefore cannot satisfy the new capture
helper's unchanged requirement for more than sixteen distinct colours when only
that sparse grid is observed. Full-image RGB analysis and original image hashes
are retained; this is not a new native render or an accepted screenshot.

The candidate considers every pixel until the seventeenth distinct colour is
found. A genuinely low-variation image is scanned completely and still rejected.
The threshold, viewport capture API, full-window capture, hashes, fixed dimensions,
post-assertion markers and primary-copy requirements stay unchanged. There is no
alternate image, resampling, repainting, fallback, retry or deadline change.

Two native regressions compile: detail located between all coarse-grid points
must be accepted, while a monochrome bitmap must still throw. They have not
executed at this evidence boundary. No production source changes.

The superseded 548216e native run is explicitly cancelled during compilation,
before any phone-wrapper step executes. The before-request and terminal job
records are retained. Cancellation is not a passing native trial and does not
replace any earlier failed result. Web checks are not cancelled or rerun here.

Four existing history cases move byte-for-byte into a short imported module;
their assertion-block hash and unchanged case count are retained. The same web
and native commands import and execute them. Both event path lists cover that
module and the new native sampling test. All original smoke workloads, uploads,
case assertions and budgets remain unchanged. No new public note, media, flow,
date, tour, status, audience, provider or Terraform change accompanies this
compiled observer correction. Complete user-flow/release proof remains open.
