# Input Feedback Width

The source-bound `836a3c91e0fbf2b3b20f72147ceddaf85bb76a46` main job
125716333182 fails with 256 ordinary cases passed, 55 skipped and four failed.
All eight notice/review/ride feedback cases pass, including both formerly failing
wide review errors. Their measured and paragraph widths now both equal 832 px.
The four remaining failures are only the new standalone input fixture.

The original archive is retained privately and independently matches the provider's
exact size and SHA-256. Selected diagnostics and reports are byte-identical.
The input text is present and visible in the actual diagnostic image. Its natural
measured width is 407 px on the narrow viewport and 139 px on the wide viewport,
while the underlying paragraph is allocated 744 and 828 px respectively. Both
therefore report horizontal overflow without height overflow. These diagnostics
do not establish missing text or clipped glyphs in a production input screen.

The candidate explicitly gives the test fixture's supporting text its available
row width, matching the fixed responsive dimensions intended by this component
test. No production source changes at this boundary. It retains the same twelve
cases, texts, themes, font scale, display/layout/containment assertions and strict
post-assertion captures. It does not lower a threshold, ignore overflow, add a
tolerance, retry or substitute a pre-assertion image. The test APK compiles; its
updated layouts have not executed at this evidence boundary.

The complete terminal checks are retained rather than treating eight component
passes as a green full gate. The failed main job and failed focused chat lane
remain failed. No diagnostic or partial collection image is published to the
progress site. The existing concise incomplete-check note, 34 flows and all
historical media/dates/tours/status/audience remain unchanged. Physical tracking,
notifications, safety audits and overall release acceptance remain open.

Existing web/native commands cover the expanded evidence contract. There is no
new workflow command, infrastructure, Terraform, Maps or production-data change.
