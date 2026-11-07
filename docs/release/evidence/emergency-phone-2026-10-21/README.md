# Emergency Contact: Physical Phone, Partial

21 October 2026 UTC. APK built from c710048, physical Pixel 8 Android 14 on the
existing subscribed App Live service. Fictional accounts and contacts only;
authentication, functions, database and realtime services use the disposable
`demo-sgm-local-qa` backend. No calls, payments or real map requests.

## Observed Replay

The eight published PNGs are unchanged 1080 x 2400 native screenshots, visually
reviewed. Filenames map to provider Downloads originals (5), (6), (7), (8), (9),
(11), (12), (13), respectively. No credential-entry screenshots were retained.

1. Own contact initially empty.
2. Parent saves Contact adulte QA, +12025550123.
3. Kill App(s), Home, then relaunch the same installed app without clearing data
   or reinstalling. Same authenticated account and contact return.
4. Verified parent selects the fictional child and saves +12025550124.
5. Separate authenticated manager SDK revokes authority. Without refreshing the
   stale child screen first, parent presses Open phone. The app removes private
   details and shows verification failure. Manager UI was not exercised here.
6. Cancel own-contact removal: full observed contact/operation/guardian digest
   remains identical to the read-only before-removal checkpoint.
7. Confirm own-contact removal: empty screen, revision 2, three total operations.
8. Sign out, sign in as the existing fictional driver, verify driver profile,
   open Options/contact: no previous account contact. Read-only driver SDK agrees.

## Unresolved Phone Handoff

Opening the adult contact's Phone action twice returned to Home. The unchanged
native `handoff-unresolved.png` proves Home, not a dialer. The app remained alive
but stopped in read-only activity diagnostics. Opening Phone independently from
its icon, and its task in Recents, also returned Home. Cause remains unresolved;
this is neither accepted dialer proof nor a demonstrated app crash. No call was
placed and no platform restrictions were bypassed.

The original ordered session retains only the first five checkpoints and closes
incomplete. The three subsequent recovery checks are separate read-only
observations; they do not skip, rewrite or accept its blocked sixth step.
`checkpoints/session-results.json` preserves that boundary and cleanup receipt.
The earlier attempt ended after a browser disconnection with five checkpoints;
`first-interrupted-session.json` is separately incomplete and cleaned.

Recording failed at startup because screen-sharing permission was unavailable.
No new video exists. Browser settings and the user's Chrome were not restarted.

## Isolation And Disposal

The signed vendor Local CLI was restricted to loopback ports 5001, 8080, 9000,
9099 (127.0.0.1 and localhost), without force-local, logging or folder access.
The existing key reached its config through a private FIFO, never process args
or a plaintext regular file. Both phone sessions showed Local Testing enabled
and force-local disabled. Tunnel exited 0; its memory credential was discarded.
Primary fixture cleanup verified protected baseline restoration. Phone stopped
at the provider dashboard. Owned backend stopped, four listeners absent and
private fixture session file removed. No temporary device admin was installed.

The demo build emitted failed FIS token-registration diagnostics. Do not infer
zero external SDK traffic from local data isolation; native SDK initialization
needs a separate audit. This trial does not prove production push delivery.

No release manifest acceptance: Options contact management is not active-ride
emergency action proof, child-own-login proof, physical GPS/background/restart
tracking proof, payment proof or iOS coverage. Hash inventory binds retained
reports and images, not an automated claim of visual correctness.
