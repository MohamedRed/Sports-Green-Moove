# Clean-Runner Chat Proof Diagnostic

The primary smoke job at 3eae535 and b40da99 repeatedly stopped during the
three-file chat confirmation-loss proof check. The original logs show runner
shutdown/cancellation; one attempt also records a killed test subprocess. They
do not establish memory exhaustion, a decoder defect, or an application failure.
Do not rerun those failed attempts into acceptance or weaken their assertions.

A new local full-size negative pixel test was also killed while constructing an
`assert.deepEqual` buffer diff. Even a 5,000-byte mismatch produced 70,096 error
characters and took about 700 ms locally. The shared frame assertion now compares
all bytes with `Buffer.equals`, still rejects either wrong length or any changed
pixel, and reports only frame length, first differing offset and two SHA-256s.
The exact-frame invariant is unchanged. This bounds failure formatting; it does
not prove that this caused the original hosted runner shutdown or repair any
underlying pixel mismatch. The hosted diagnostic must expose those separately.

This independent short job uses the primary lane's Ubuntu runner, Node 22,
locked dependencies and media package. It first executes the same six original
FFmpeg decode/crop commands, comparing every RGB pixel of the three reviewed
captures. Per-image start/end markers identify incomplete decodes. It then runs
the unchanged exact primary three-file test command. No service, app, emulator,
account, secret, provider request or payment is started.

A bounded sampler records only host memory counters and cgroup memory/event
counters every half-second, at most 600 samples. Unsupported counters are
explicitly unavailable. Raw proc files, arguments, environment variables and
unfiltered errors are never retained. The sampler changes neither media thread
counts nor test execution bounds. The first failure stops the diagnostic; there
is no retry, alternate decoder or fallback. Cancellation forwards only to its
owned direct child and stays a failure.

A pass proves only that the exact pixel comparisons and three-file tests passed
on that clean runner. It cannot replace the original smoke gate or accept a
phone flow, root cause or release. Inspect the primary gate separately. A failed
or interrupted diagnostic remains failed even if resource samples are available.

Web Integration Smoke tests the diagnostic boundaries independently. No cloud
infrastructure changes are made, so no Terraform change is required. This
preparation alone does not change any public flow status, gallery or date.
