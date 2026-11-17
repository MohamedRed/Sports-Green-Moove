# Keyboard Layout Verification

The accepted directory proof in this folder remains run `38814000395` on
`6bd7c35`. It predates the keyboard-visible layout checks and is not rewritten.

[Native run 38816750105](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38816750105)
on `b20a84d` passed the preceding local cases and reached the new directory
send. The actual keyboard appeared and the conversation controls were visible.
The check then dismissed the keyboard before sending, received the stored
message and cleared draft, but timed out waiting for the composer to return
to its original coordinate. No successful directory `results.json` was emitted.
This run is diagnostic, not accepted evidence of a resize correction.

The check did not establish that the keyboard stayed hidden after the send.
The composer changes its read-only state during acknowledgement, so the
previous test sequence cannot establish whether the remaining offset is an
open keyboard or a restored-layout defect. The exact cause is not yet proven.

The revised sequence sends with the keyboard open, waits for both the stored
message and completed send, checks the controls again, then explicitly hides
the keyboard and requires the original coordinate. It preserves sanitized
header/composer bounds and actual IME visibility before/after acknowledgement
and dismissal, plus a diagnostic capture even if coordinate restoration fails.
No assertion is skipped or replaced with a fabricated result. The revised
sequence still needs a fresh complete run before acceptance.
