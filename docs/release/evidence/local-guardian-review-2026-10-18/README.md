# Isolated Parent Verification Review

Completed 2026-10-18 at 16:25:45 UTC, run `1397a836afc2cb1a87e8a8ebf834092a`.
`results.json` is the unchanged generated report. `artifact-sha256.json` protects
that report and eight original screenshots. Its source hashes matched the tested
implementation when retained. All people, children and clubs are disposable QA
fixtures. Screenshots contain no passwords, email addresses or production data.

## Verified

- 16 signed-in HTTP groups cover bounded private lists, current club authority,
  admin-with-manager scoping, owner-only parent history, cursor isolation,
  pagination, malformed records, removed eligibility, self-review denial and
  revision-bound decisions. Historical requests do not reveal a child's current
  name after the parent link is removed, nor current family names to a club after
  the parent's membership ends. Read-only lists leave protected records unchanged.
- Nine browser groups use the actual management application, signed-in manager,
  local Auth/Functions/Firestore and actual verification/audit writes. They cover
  confirmation, cancellation without writes, verification, refusal, revocation,
  25-row pagination and sign-out clearing private content.
- A lost response is injected only after the local service has processed the
  request. No verified result is shown from that lost response. Stale actions are
  cleared; explicit refresh recovers the committed state with exactly one event.
- Layout checks and reviewed captures cover 1440, 768, 390 and 320 pixels. The
  confirmation button uses readable dark text on its inherited green fill.
- All browser requests stay on loopback. Zero provider requests/production writes.

The first UI pass also completed but its bright confirmation button needed a
contrast correction. The retained report is a fresh full pass after that change,
not a renamed earlier capture. The subsequent profile-privacy review added one
HTTP group and reran the full browser flow. The previous completed 15-group run
and its original captures/hashes remain in `before-profile-privacy-guard/`; it
does not prove the later privacy guard. An initial service-test assertion incorrectly
assumed the seeded manager lacked a parent role; its declared roles were checked,
and the denial case now uses an explicitly manager-only fixture.

## Scope Still Open

This is management-web evidence, not native parent UI, a physical device, a live
deployment or an operational release. Parent request/withdraw/reopen screens,
child/team enrollment, group conversations and emergency contacts remain open.
No production services or public management website were deployed. Existing
booking/search guardian authority has not been changed or silently migrated.
No tracking guardian-consent or other release safety-audit item is accepted here.

Earlier [verification lifecycle proof](../local-guardian-verification-2026-10-18/README.md)
and [membership refresh captures](../local-membership-refresh-2026-10-16/README.md)
remain separate, dated evidence. Club membership is not parent verification.
The [team-ownership boundary](../local-team-ownership-2026-10-16/README.md)
also remains unchanged; it does not implement team enrollment or conversations.

## Replay

`npm run test:guardian-review` runs the 16 HTTP groups. For full browser replay,
provide a fresh absolute `SGM_LOCAL_FLOW_OUTPUT`, a fresh absolute screenshot
directory in `SGM_GUARDIAN_UI_OUTPUT`, and the configured Playwright runtime and
executable, then run `node scripts/qa/run-local-guardian-review.mjs --browser`.
The helper creates isolated credentials in memory and destroys its runtime.
