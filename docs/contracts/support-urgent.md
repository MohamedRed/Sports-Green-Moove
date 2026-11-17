# Urgent Support

## Confirmed Product Decision

An urgent request alerts **support only**, through an email and the support
management space. Club managers are not recipients and gain no access. The
owner supplied the destination privately; keep it in server secret configuration,
not source, screenshots, reports or the progress portal. The destination is not
an approved sending address.

## Delivery Contract

- Both current and installed-client submission endpoints create a same-ID urgent
  outbox record atomically with the report. Reused submissions do not enqueue again.
- Ordinary requests do not enqueue email. Report contents and internal notes are
  excluded from the notification. Its link requires authenticated support access.
- A dedicated active-urgent query is not limited to the ordinary first fifty rows.
  Closing a request removes its active alert. A direct email link reads the named
  report even when it is closed and outside that ordinary window.
- Clients cannot write the outbox. Only administrators can read it or explicitly
  retry. No role grant or club-manager notification is part of this work.
- A transactional two-minute lease excludes concurrent workers. The first attempt
  freezes the single recipient and message. Retries use the same provider account,
  payload and deterministic idempotency key. Do not change provider accounts while
  an ambiguous operation is pending.
- Temporary transport/provider errors remain retryable. Missing configuration is
  visible and needs explicit retry after configuration. Invalid content or an
  ambiguous send older than 23 hours requires review, not another provider send.
  The bound is below the provider's documented 24-hour idempotency retention.
- `accepted` means accepted by the sending provider, **not inbox delivery**. No
  SMS, club alert, alternate provider or fallback delivery is implemented.

## Production Activation Is Still Open

No mail account, verified sender, DNS record, API key or paid plan was created.
No real email was sent and no urgent production deployment is accepted.

Configure server secrets `SUPPORT_EMAIL_API_KEY` (sending-only key) and
`SUPPORT_EMAIL_CONFIG` (strict JSON with `from`, single `to`, `adminOrigin`). The
adapter targets Resend. Use a verified sending domain/address, the privately
confirmed destination, and the real authenticated management HTTPS root origin.
Never copy the owner's inbox into the repository. Provision provider/DNS changes
through Terraform when the approved account and sender are available; no such
resource was provisioned here. The new report query index is codified in
`firestore.indexes.json` and access controls in `firestore.rules`.

Before activation: approve/setup the sending account and sender, bind secrets to
the deployed functions, deploy the index/rules/admin/functions, and retain a
sanitized end-to-end urgent submission with actual inbox receipt and support-space
alert. Verify recipient, link authentication, latency, error visibility and no club
notification. Local loopback-provider acceptance is not that evidence.

Provider idempotency reference:
https://resend.com/changelog/idempotency-keys
