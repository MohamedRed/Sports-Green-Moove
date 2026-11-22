# Production backend release review

Target: existing project `sports-green-moove-prod`. Baseline source:
`46f7ee14e8bc111526edf4f5bdac8f42408919f4`.
Status: preparation; no production change is approved or executed here.

## Decisions needed before a deployment candidate is ready

1. **Publishing authorization.** Choose active membership in the selected club
   only, or in both the club and team. Implement the chosen server-side rule,
   retain the current verified-driver requirement, validate the club/team
   relationship, align both native clients and test denial paths before rollout.
   The current callable must not be treated as having either membership rule.
2. **Urgent-support sender.** Designate an existing verified Resend sender/domain
   and sending-only key, or approve a separately reviewed provider/DNS setup.
   Keep the already confirmed recipient private. Server configuration requires
   the sender, that single recipient and the authenticated management origin.
   Enter key/configuration values directly into Secret Manager, never a chat,
   commit, screenshot or command argument. No sending provider is provisioned.
3. **Rules state ownership.** Designate an existing owner-controlled Terraform
   state backend or review a proposed dedicated protected GCS state bucket.
   No Terraform-named state bucket was observed in this project's bucket list;
   that does not rule out an existing backend elsewhere. The current rules
   module has no selected remote backend. Do not guess one or use an application
   data bucket as an implicit state store.

## Proposed rollout for subsequent review

- Retain and verify restorable artifacts/configuration for all 31 existing
  functions before updating them. This preflight retains sanitized metadata,
  not secret values, a source-code backup or a proven Functions rollback.
- Implement and verify the chosen publishing policy. Produce a new candidate
  commit and rebuild Functions; refresh this comparison if service exports,
  rules, indexes or the deployed baseline changed.
- Review the 26 additional composite indexes in `index-comparison.json`.
  Preserve all ten deployed indexes and wait for the additions to become ready
  before enabling dependent query paths. The canonical definitions remain in
  `firestore.indexes.json`; select one deployment writer for the index rollout.
- Reconcile the retained Firestore policy delta and use
  [the existing rules Terraform module](../../../../infra/firestore-rules/README.md).
  The current immutable ruleset name is retained in `metadata.json`; old
  rulesets must remain available. Do not use a concurrent Firebase CLI writer
  for the same rules release. Stage and verify the required server callables
  before activating the tighter client access rules. Review installed client
  compatibility and existing membership field shapes first: records without
  the required active-manager fields will lose that direct access. Do not
  silently migrate live records or infer authority from a role label.
- After sender/provider approval, codify any required provider/DNS resources
  and secret resources in Terraform. Supply secret versions through a private
  input path, then review the deployed functions' secret bindings and runtime
  access. Missing configuration must remain visible; do not add fallback mail.
- Deploy the reviewed current Functions codebase. The current comparison adds
  70 names and removes none; it also updates the implementations of the existing
  31 names. Review compatibility with installed clients, callback endpoints and
  existing provider configuration before approving this operation.
- Storage and Realtime Database rule sources match; this comparison proposes
  no rule replacement for either service. It does not establish that provider
  delivery, location permissions, push registration or private native sockets work.
- Verify production endpoint availability and authorization, query/index readiness,
  current-authority chat access, single-application receipts and urgent-support
  failure visibility. Retain sanitized results and perform the supported Android
  BrowserStack release scenarios only after their backend prerequisites pass.
- Continue the full native CI investigation. The eleven focused Android cases
  pass on this source after the Maven-download retry. The full ordinary matrix
  remains incomplete at its host deadline; neither its transcript nor the later
  local replay is a full-gate pass. Do not accept or silently narrow that gate.

## Approval boundary

The repository's rules release instructions explicitly require:

> Before any plan/apply, obtain explicit approval for the target environment,
> export and review its current rules, reconcile any production-only changes and
> choose an owner-controlled state backend.

The current rules export and policy comparison are complete. Policy, sender,
state backend, restorable Functions artifacts and a final deployment candidate
are not yet approved. No Terraform plan is claimed. Once those prerequisites are
resolved, request approval for the explicit target and reviewable plan workflow;
inspect its actual changes before production application.

Deployment would still be separate from MVP acceptance. The final release must
pass `validate-release-evidence` with reviewed production device, operational,
emergency handoff and safety-audit proof.
