# Approved iPhone capture bounds

On 4 November the user approved exactly three synthetic captures, at most
2,000,000 bytes total, retained for one day. The user separately approved raising
the public iPhone job limit from 35 to 50 minutes, without changing the tests or
adding other storage. `approval.json` records only those limits, not credentials.

The existing seven cases remain. Three positive checkpoints save original PNGs:
authenticated home, the synthetic account profile and rating-submitted feedback.
Collection requires an explicitly opted-in manual run; it is off by default and
ordinary pull-request runs do not repeatedly retain another set of images. The
opt-in is embedded in the generated test bundle, not inferred from live accounts.
It uses the existing explicit generated-plist pattern. Apple's
[property-list guidance](https://developer.apple.com/documentation/bundleresources/managing-your-app-s-information-property-list)
confirms that arbitrary custom `INFOPLIST_KEY_` settings are not emitted, so no
such unsupported setting is used for this opt-in.
The helper requires fixture mode, foreground app and expected visible state; no
password form, production account, extra image, overwrite or video is retained.
It refuses unknown file sizes and reserves archive/manifest overhead by limiting
the three image bytes to 1,900,000.

The collector locates the exact installed UI-test runner, validates all three files
before copying them unchanged and checks the copied hashes again. System ImageIO
decodes each PNG; dimensions, mixed-size, nonblank-pixel, corrupt-file, symlink,
missing/extra-file and byte-budget checks fail closed. A small manifest binds the
source head, actual tested merge commit, run and original fixture outcome. The
payload is capped at 1,990,000 bytes, leaving ZIP overhead within the 2 MB approval.
The upload allowlist contains only those three PNGs and that manifest, with one-day
retention, no hidden files and no overwrite. It never uploads the result bundle,
logs, source, app binary or a dependency cache. Native simulator deletion remains
an always-run step.

Images can be collected after a failed fixture step only when all three positive
checkpoints produced valid images. Its original failed outcome is preserved in
the manifest; collection cannot accept a failed UI gate. Cancellation or skipped
tests produce no upload. Missing/oversized captures are rejected, not resized or
replaced. There is no fallback capture mechanism.

`policy-checks.txt` proves local policy checks with generated fixtures only. The
first local self-test draft put a throwing call inside a nonthrowing assertion;
it was corrected before any collection. The test producer still needs an actual
SDK build, executed UI cases and exported files. No iPhone capture has yet been
accepted or published by this preparation. Downloaded captures must be visually
reviewed and sanitized before any public portal publication.

The [official upload action documentation](https://github.com/actions/upload-artifact/tree/v4)
documents the retention and explicit upload options. This change retains the
repo's existing v4 action family and adds no Terraform infrastructure.
