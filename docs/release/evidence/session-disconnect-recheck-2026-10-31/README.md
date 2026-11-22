# Independent Disconnect Replay Recheck

Native CI job 124543847357 on `c76c3ce` passes the original two-process
disconnect journey. The signed-in parent sees the controlled restoration error,
chooses Disconnect and reaches sign-in. After a guarded force-stop, a distinct
app process still has no authenticated identity before or after launch. Both
original one-case transcripts, three original screenshots, checkpoint, proxy,
primary copy, SDK stored-state comparison and independent policy restoration
are retained. All four owned backend ports are verified closed. No account,
claim, booking, message or live-trip record is changed beyond the allowed parent
timestamp. This is a local simulated-device replay, not physical outage proof.

The previous job 124540585301 on `51c183e` fails its first authentication call
to the local auth endpoint, before reaching the app's restoration-error screen.
Its failed transcript, empty proxy history, nonzero suite status and successful
independent cleanup are retained separately. Every source binding in the passing
report has identical bytes at both commits. This is not an application repair:
the compiled APKs have different hashes and are not claimed byte-identical.

Both original provider ZIP digests and sizes were independently verified. Every
selected member was compared byte for byte with its download and is bound to
the retained archive-verification record. Whole ZIPs remain private and are not
published; local bundle validation rechecks the selected files and metadata, not
the private ZIPs. Original logs unrelated to this assertion are not published.

The subsequent `8c813e9` change reuses the existing bounded local network/socket
observer in the disconnect test. It changes no product code, credentials, route,
retry count, UI predicate or original timeout. These two retained jobs predate
that change and do not prove the new observer executed or the original cause was
fixed. Compilation and synthetic tests are separate evidence.

Whole Native CI, physical network loss, an active-ride outage, production, iOS,
tracking, safety audits, store review and release acceptance remain unproven.
No new partner-gallery media is added. The original 20 October gallery and tour,
dates and partial status remain intact; only a dated recheck note is added.
