# Local Service Shutdown

The preceding physical history replay exposed a real cleanup defect: interrupting
the synchronous launcher terminated its parent before Java descendants and its
private fixture file were cleaned up. That run was cleaned explicitly, as recorded
in `../phone-team-history-2026-10-19/teardown.json`; this does not rewrite it.

The long-running UI launcher now supervises a fresh owned POSIX process group
asynchronously. SIGINT/SIGTERM are forwarded only to that group. It waits for
group exit before returning to its private-file/runtime cleanup. A pre-start stop
does not spawn; spawn failure, nonzero failure and unexpected live descendants
remain failures. No forced-kill fallback, personal-process signal, provider access
or global setting change is introduced. Short-lived existing suite runners retain
their current synchronous entry path.

`unit-tests.tap` retains seven actual subprocess regression passes, including
descendant cleanup and preservation of a real failure during a stop. The original
`services.json` then records two complete, independently started local sessions:
SIGINT exited 130 and SIGTERM exited 143, both after service shutdown, automatic
private-file removal and refusal of all four loopback service ports. No manual
process/file removal was used in those two checks. Original source versions and
artifact hashes are retained. This proves local service lifecycle, not phone UI,
tracking, payment, production infrastructure or release readiness.
