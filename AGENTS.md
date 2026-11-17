# Repository Instructions

- Keep changes scoped, preserve working code and unrelated user changes.
- Use modular code files below 300 lines; split modules when needed.
- Fix root causes; do not add fallback behavior without approval.
- Remove superseded unused code when replacing an implementation.
- Keep secrets out of source, logs, screenshots, recordings and reports.
- Keep UI responsive; visually verify desktop and mobile changes.
- Commit and push completed work to the active user-owned branch.
- Codify infrastructure changes in Terraform where applicable.
- Check whether `.github/workflows/web-integration-smoke.yml` needs coverage.

## Partner Progress Website

The user requested an ongoing visual follow-up site. On 23 October 2026 the user
explicitly chose to keep the existing Site public. Canonical source is
`partner-portal/`; the published site is separate from public Firebase Hosting.
Read `partner-portal/README.md` before changing or publishing it.

When completed work changes a user-facing flow, a verified result, or a blocker:

1. Update the relevant record in `partner-portal/content.mjs`, with the actual
   verification date, source and remaining limitations. Add a dated progress entry.
2. Add only reviewed, sanitized evidence. Prefer a short action/result excerpt;
   retain the original recording and identify edits. Never infer a successful
   transaction or message exchange from an empty screen or passing CI.
3. Validate, rebuild and review affected screens. Commit/push canonical changes.
4. Publish the matching Sites snapshot with its confirmed public audience using the documented workflow.
   Report deployment success separately from committed or locally verified work.

Never change the Site audience without a new request or invite a guessed address.
Publish only reviewed synthetic evidence, never raw diagnostics or private contacts.
The partner's email is not known yet. Do not mark the overall user-flow release goal complete while
required physical tracking and safety-audit evidence is missing.
