# Recorded Source Archive

These files preserve exact source bytes already named by dated team-enrollment,
component, phone and management evidence. A filename is the source's original
SHA-256, followed by `.txt`; identical source versions are stored once.
`provenance.json` records the matching Git object used to recover historical
versions, or the run ID for a newly verified worktree snapshot. Recovery commits
identify matching bytes, not necessarily the test run's head. New snapshots must
match the source hashes emitted by their actual run before being archived.

Retained-evidence readers use this archive explicitly and fail if a source is
missing or altered. They never fall back to the current checkout. Original
reports, timestamps, captures and their artifact hashes are unchanged. Current
code has separate build, unit, service and UI checks: historical evidence cannot
prove that a subsequently changed application was tested.

The archived text is not compiled, imported or deployed as application code.
