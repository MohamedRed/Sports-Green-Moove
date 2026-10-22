# Preinstalled Android Matrix

The default Native CI matrix uses one fresh disposable Android emulator. Before
booting it, `build-android-matrix-apks.mjs` builds both explicit configurations,
staging the ordinary and isolated app/test pairs with their output metadata and
SHA-256 digests. A stale staging directory, wrong application ID, missing output
or failed build stops the job. No phone is booted after a failed build.

Preparation installs those four owned APKs before activating the approved
installation guard. It verifies the installed byte digests, unchanged map runtime,
enabled location and restricted store background operations. The store's stopped
state is an observation, not a substitute for the continuous installation policy.
Active installs still fail preparation; no installation is interrupted or retried.

The ordinary stage invokes the existing guarded AndroidJUnitRunner directly using
the standard raw instrumentation protocol. No class, package, annotation or shard
filter is supplied: all discovered cases remain required. The parser requires the
guard packet, every matching start/end, a stable complete inventory and a final
runner result. It retains explicit assumptions/ignores and fails on test failures,
crashes, truncation or command failure. Original redacted output and JUnit XML are
retained. The last successful historical matrix had 197 cases; this change does
not claim that a new device run has completed.

The isolated stage claims the same four-APK receipt after the ordinary stage. It
clears only the isolated pair, rechecks installed/staged digests and the guard,
then executes the unchanged 36 flow groups / 38 native cases. It does not rebuild,
install APKs or open an installation window. The selected CI mode cannot silently
use the standalone runner when its receipt or approval is absent. Existing
explicit standalone/manual runners remain separate.

Ordinary or capture failure does not suppress the independent isolated replay.
Loss of the installation guard stops further app execution. Every normal exit
after setup independently attempts package removal, store/launcher restoration
and administrator removal; the original suite failure retains precedence. The
legacy `localPackagesRemoved` receipt key means the exact selected owned APK set
(four in this mode). Cleanup is not inferred from process exit alone.

The bounded host observer runs only after verified cleanup and cannot mutate the
phone, signal processes or turn a diagnostic into flow/root-cause proof. Its
evidence is retained before artifact upload. Native and web CI exercise the new
parser, build/receipt contracts, failed setup and replay/capture/cleanup precedence
without provider calls. No Terraform resource or billing change is involved.

This is isolated CI evidence only. Physical tracking, live provider operations,
production release and private-site publication require their own verification.
