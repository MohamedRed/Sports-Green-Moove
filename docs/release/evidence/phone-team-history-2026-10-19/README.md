# Owned Team History On One Physical Android Phone

On 19 October, source `e3ddba1f8f53b6f77bec2ec35491838c3b495c2a`
was built as `be.sportgreenmoove.app.local`, with isolated services enabled and
host `127.0.0.1`. The uniquely named APK was uploaded and its successful
installation observed on a Google Pixel 8 / Android 14 in the existing App Live
subscription. Its SHA-256 is recorded in `results.json`.

The parent signed into a fresh local-only session. The fixture prepared 26
enrollments using real authenticated service calls; two were approved through
a separate manager SDK session. Parental verification was then revoked and only
the fixture club membership deactivated. These decisions are preparation, not
manager UI or physical-phone revocation evidence.

Observed native actions: open owned history without selecting a current team,
load the six requests beyond the first twenty, inspect the approved personal
enrollment, open/cancel its confirmation, reopen and confirm one withdrawal,
inspect the redacted approved-child enrollment with only Close available, leave
and reopen history, explicitly refresh and reread the withdrawn enrollment.
The current club chooser contained the baseline club, not the deactivated
fixture club. The five CLI checkpoints independently verify exact stored states
and audit actors. Cancelling did not create an event; the final adult record is
withdrawn revision 3 and the child remains approved revision 2, without actions.

Twelve original browser-context JPEGs are unchanged. Twelve PNG derivatives crop
only the observed device rectangle (613,111,275,610); no app pixels were edited
or fabricated. They are browser-rendered phone views, not native 1080p exports.
The browser's direct rectangle screenshot timed out before any file was saved;
the supported native screenshot API retained the original contexts instead.
No video was recorded. Credentials and login screens were not retained.

The strict loopback allowlist and disabled verbose/API/MITM/folder settings were
read from the actual helper controls before fixture credentials were created.
That policy does not claim zero unrelated platform traffic on the whole phone.
The phone was released and the tunnel visibly disconnected. Fixture cleanup
verified protected records and roles. Interrupting the synchronous local runner
left two owned Java processes and its private file; these were explicitly
terminated/removed, followed by the temporary runtime. The helper launcher and
its children were also stopped. The five listening ports were then absent.
This is verified explicit cleanup, not a claim that interrupt cleanup is fixed.

This does not prove full-process restart, another phone, iOS, management UI,
group conversations, push, real tracking, payments or production deployment.
The release manifest remains unchanged. The current-head provider check failed
on a callback-host timeout; an independent read later returned HTTP 200. That
read does not change the failed check or prove the entire payment flow.
