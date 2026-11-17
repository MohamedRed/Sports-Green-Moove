# Native Network Recheck

Both observations use source `959e70b41abb039037f94e6eeec8402b597b5bff` and run
`42251215886`. Original archives are independently matched to the artifact API's
exact size and SHA-256; only selected sanitized metadata/transcripts are retained.
No new session, image, recording or provider transaction was started.

## Isolated Recovery

[Job 128006497904](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42251215886/job/128006497904)
passes the unchanged case. Its passive pre-installation Wi-Fi observation starts
unready, then becomes ready in two samples without radio/logging/settings changes.
The UI verifies Wi-Fi to cellular, offline send with retained draft, restoration,
one explicit retry, reply, account isolation and restoration of the parent's
private draft. Independent stored state has two messages/two notification records
and zero duplicate messages. This is controlled emulator proof, not physical
network loss, push delivery, token expiry or process-restart proof.

The primary evidence copy, APK identity, continuous installation guard, local
client shutdown, emulator endpoint closure, package/policy restoration and passive
host exit are retained separately from case success.

## Full Matrix

[Main job 128006497424](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42251215886/job/128006497424)
has 299 passing and 55 skipped ordinary cases, successful component collection,
then an incomplete local replay. The final chat case times out at its original
30-second preparation predicate, before any radio cut or retry.

Both requested networks are available, the backend is reachable, the default
data subscription exists and callbacks are registered. The default transport is
cellular; available Wi-Fi is unvalidated. Bounded read-only history records Wi-Fi
DNS failures while cellular records successful HTTP/HTTPS validation. These
non-atomic observations do not prove why DNS failed or why the OS selected a
particular default. The prior missing-subscription failure is a different state.
Callbacks are released and package/policy restoration plus host exit are verified.
No whole-native or whole-replay success is accepted.

The focused entry already waits for validated default Wi-Fi before installation;
the full entry omitted that prerequisite. The candidate adds that same passive,
bounded check before installation, retaining every other command and all native
tests/predicates/deadlines. It adds no resolver override, forced network binding,
retry, radio mutation, alternate test or fallback. This closes an orchestration
gap, not the underlying DNS issue. The corrected unchanged-source host regression
changes from three failures/one pass to four passes. The initial harness wrongly
expected inner sentinel exit codes instead of the wrapper's existing exit 1;
that assumption is retained and is not counted as a production defect.

## Separate Callback Observation

Source 376's provider-readiness job `128041172906` times out on the refresh health
endpoint. Two later independent public health GETs return 204 with exact markers
and no-store headers, without credentials, writes, onboarding or payments. This
does not reproduce the original runner's network state, diagnose the timeout,
repair a service or accept complete provider readiness.

All historical successes/failures, current release requirements and public-site
audience remain unchanged. Physical tracking, emergency handoff, operational
push/support and safety/payment audit evidence remain separate release gates.
