# Parent Phone And Club Manager Team Enrollment

On 19 October, the current isolated APK ran on a BrowserStack App Live Google
Pixel 8, Android 14, using the existing subscription. The parent used the actual
app; the manager used the actual local management website in a separate browser.
No parent request or manager enrollment decision was substituted with an SDK call.
The APK was built from `21190ff46ae631901d45c2f33f04ea97def263e6`, with the
demo project, `.local` package and `127.0.0.1` emulator host. Its SHA-256 is in
`results.json`. The new manual checkpoint sources are bound separately by twelve
source hashes in the unmodified `session-results.json`.

## Executed Journey

The existing synthetic parent signed in, opened Profile, Mon club, and Inscription
a une equipe. After reviewing and confirming a request, the app showed it pending.
The manager selected the same club/team, refused it with explicit confirmation,
and the parent reselected after a full refresh to see the refusal. The parent made
a new request, the manager approved it through its confirmation dialog, and the
parent read the approved state without losing the selected team. The parent then
reviewed and confirmed withdrawal; the manager saw the withdrawn state.

The parent selected the verified child, reviewed and confirmed that child's
request. The manager saw it alongside the parent's withdrawn record and approved
the child through its own confirmation. The parent read the child's approved state.
All seven independently persisted checkpoints passed with exactly two enrollment
identities and seven ordered events, the correct actor on each event, exact
revisions and no duplicate request. Fixture cleanup restored unrelated records and
roles, apart from the explicitly allowed monotonic QA parent sign-in timestamp.

The parental link was prepared by two actual authenticated local fixture
transitions (request and verify), not by writing an approved record directly.
Those preparation calls do not prove the manager's parental-verification UI in
this run. The enrollment decisions themselves were all made in the manager UI.

## Captures And Isolation

Seven phone captures and five management captures were visually reviewed. The
original returned bytes are JPEG; their file extensions reflect that format,
without re-encoding the originals. The phone images are **274 x 610
browser-viewport captures of the live device screen**,
not original 1080 x 2400 device exports. The rectangle excludes the test-service
controls and does not alter app content. The service screenshot control completed
without a retrieved download; a bounded download observation timed out. No native
pixel export is claimed. One later browser screenshot observation also timed out;
the same still-live session was rechecked and read again without repeating a
decision. The observed state and independent stored checkpoints remain distinct.

Recording failed to start with the operating-system screen-sharing permission
message. There is no new video and Chrome was not restarted. Remote keystrokes
initially produced an incorrect-password response; exact native clipboard insertion
then signed into the existing QA account. No credential-entry capture is retained.

The signed/notarized official local helper was used. `connection-policy.json`
records the exact four loopback-service allowlist, Force Local off, verbose/API
request logs off, no MITM proxy and no workspace-folder sharing. These are observed
private-tunnel settings, not proof that the whole phone has no external platform
traffic: public Android/Google service connections were visible in its connection
summary. The app's test data and authenticated application actions used the demo
services; no production account, payment or application record was used.

The phone was released, the manager signed out, the helper disconnected and its
owned processes stopped. All five owned service/preview ports refused connections,
the private session file was removed and the original clipboard was restored.
`teardown.json` retains these scoped observations. The CLI's first noninteractive
stdin closed before any action; its original `initial-stdin-close-session.json`
records an incomplete result and cleaned fixture. Only the subsequent interactive
seven-checkpoint run is accepted here.

## Still Required

Full process restart, phone-side parental revocation, account switching in this
team flow, two phones, other device/platform coverage, team history/group chat and
production deployment remain unproven. This run does not accept physical GPS,
background tracking, real payment or release safety-audit requirements. The whole
CI native matrix is also not accepted: its separate 21190ff run failed during
device preparation, before opening the app.
