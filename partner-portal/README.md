# Partner Progress Portal

Private, evidence-based project updates for Sports Green-Moove. Canonical source
lives here; publishing uses the separate Sites repository. Never deploy this
directory to the public Firebase application host.

## Access

- Site: https://sports-green-moove-progress.mohamed-redha.chatgpt.site
- Project ID: `.openai/hosting.json` is authoritative.
- Sites authenticates visitors and restricts every request, including static media
  and `data.json`. This is not a JavaScript password screen or an unlisted URL.
- Owner-only for now. The user does not know the partner's email yet.
- Before a future invitation, read Sites access and confirm external invitations
  are enabled. Add only the explicitly supplied email; preserve other access.
- No Firebase accounts, roles, billing, Terraform resources or production data are
  created by this site. Hosting identity/configuration is codified in the manifest.

## Content And Evidence

`content.mjs` is the curated, French-language source; `recent-progress.mjs` holds
the newest progress entries. Its `captures` allowlist adds
reviewed device-only screenshots from dated evidence directories without another
crop to app content. Each flow distinguishes status, dated verification, evidence
source and remaining scope. An empty screen
does not establish completion. Existing release manifests remain authoritative for
final release approval; this portal does not accept new release evidence itself.

The builder copies only allowlisted media. Historical screenshots are cropped to
the device, not altered inside the app. Four 13-16 second excerpts are trimmed at
real speed from the October 13 replay exports; no transition or outcome is
fabricated. Those exports remain available as long recordings. The sign-out long
export already omits troubleshooting, as documented in its original report.

Keep the partner-facing copy brief and conversational: videos, short updates,
and concrete next steps. Do not repeat report disclaimers across the page. Keep
test status and actual limitations clear; put recording context in optional details.
Do not name technologies, providers, device models or testing tools in the portal
copy. Describe user actions and outcomes; keep technical provenance in repository
reports. Preserve the original app captures rather than editing their contents.

Local service checks use a `local` record with a sanitized JSON evidence path,
successful scenario IDs and short result statements. Validation checks that the
referenced groups passed on the displayed date. These flows stay `partial`, show
an explicit local-test date and a results list, not a fabricated app capture.
Retained older captures carry their original test date in their caption.

Local app/management screen checks use a separate `ui` record backed by scoped
result JSON. These remain partial and dated as local trials, with reviewed captures
shown before older service-check lists. A screen test does not accept GPS,
background tracking, push delivery, live-provider or physical-device requirements.
Never publish black/blank captures from rendering-disabled test device images.

Browser assets use a content-derived directory so HTML, styles and JavaScript
modules cannot accidentally reuse an older bundle after deployment. Publishing
also checks that the generated bundle matches the current source.

Dates in the page are explicit snapshots, not an automatically refreshed live
status. Update `updatedAt` when content changes and `lastVerifiedAt` only when a
new verification actually occurred. Evidence source hashes are included in the
generated JSON for traceability. Never add credentials or unreviewed media.

## Validate And Preview

From the repository root (Node 22 and FFmpeg required):

```sh
npm ci --prefix partner-portal
node --test tests/partner-portal.test.mjs
node scripts/build-partner-portal.mjs
python3 -m http.server 4177 --bind 127.0.0.1 --directory partner-portal/dist
```

Open http://127.0.0.1:4177. The loopback-only preview is not an authenticated
deployment; never expose it as a public tunnel. Browser QA lives in
`tests/partner-portal.browser.mjs` and accepts `PLAYWRIGHT_MODULE_PATH`,
`PLAYWRIGHT_EXECUTABLE_PATH`, `PORTAL_URL` and `PORTAL_QA_DIR` for a supplied
Playwright runtime. It tests playback, deep links, filters, dialogs and overflow
at 320, 390, 768 and 1440 pixels. Use a separate headless browser, not the user's
existing browser profile. Web Integration Smoke validates content contracts.

## Publish Or Update

Use the installed Sites skill and tools. Do not call `create_site` again.

1. Validate, build and review media/layouts. Commit and push canonical source.
2. Read the Site and acquire its short-lived source write credential. Keep it in
   session memory; pass it to the Sites workflow helper only through hidden stdin.
3. For updates, open the existing separate Sites checkout with the helper first,
   so remote changes are reconciled before replacing the generated snapshot.
4. Export to a separate checkout, for example:

   ```sh
   node scripts/prepare-partner-portal-publish.mjs /private/tmp/sgm-partner-site
   ```

5. From that checkout, run the Sites `site-workflow.mjs` helper with the exact
   project ID. Supply `credential`, the prior opening `source` result when present,
   `commands: []`, and an absolute `archivePath` via hidden stdin. The helper commits,
   pushes and packages the matching static snapshot. Never run it at the app root.
6. For confirmed owner-private access use `save_version_and_deploy_private` with
   the helper's exact project ID, commit SHA and archive. After an invitation,
   inspect the audience and use the appropriate shared-site deploy operation.
7. Wait for deployment success. Verify anonymous page, JSON and media requests are
   denied or redirected; verify authorized content through the supported access.
   Do not rotate credentials or widen access to perform a check.

Publication is part of meaningful completed work, not an unattended schedule or an
automatic CI deployment. If publication is blocked, report the last published
snapshot and the unpublished changes rather than claiming the website is current.
