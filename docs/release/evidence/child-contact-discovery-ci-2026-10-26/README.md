# Child Discovery CI Recheck, 26 October 2026

Original pushed source: `61d1294e934005edd0e16c6b5086200cf684b71c`.
Native run `40314940529`, main job `121545058155`, concluded failure.
The original ordinary component report contains 224 cases: 169 passed,
54 intentionally skipped and one failed. Its original XML and result JSON are
retained unchanged, with the native-suite exit-status report and checksums.

The only failed case is
`ChildRideEmergencyFlowTest.settingsEntryWithoutARideDoesNotReadOrManageTheChildContact`.
It expects the former static no-ride screen and zero reads even though the
updated route now discovers the child's ride independently of an adult snapshot.
The fixture returns an active ride, so expecting the no-ride message is obsolete.
The correction gives the fixture an explicit no-active-ride discovery response,
waits for that response and checks one discovery, zero known-ride reads, no dialer
or edit controls, and continued availability of account linking.

Both denied-location child component cases passed in this original run. They use
mocked contact data and dialer callbacks, not a physical child login or real
dialer. All ten focused native jobs and the backend/web checks passed separately.
None of those successes overrides the failed main job. The corrected case needs
a new complete execution before accepting that gate. No screenshot is published.

The original failed case and surrounding production component sources are pinned
in `source.json`; the new candidate does not rewrite this negative record.
This adds no physical, production, iOS, invitation or release acceptance.
