# Read-Only Provider Prerequisite Review

28 October 2026. No device launched, account upgraded, message sent, cloud project
created, billing account changed, paid map request or customer record used.

## Parallel Phones

The signed-in subscription page offered an annual switch for Individual and
upgrades for Team/Team Pro. The official multi-device page states that concurrent
App Live devices require Team Pro or above. No entitlement or two-device session
was accepted from this review. The subscription was left unchanged; do not replace
required two-phone evidence with a sequential one-phone test.

Source: https://www.browserstack.com/docs/app-live/multi-device-testing

## Android Phone App

Two current first-party FAQs conflict. The default-app restriction table lists
Android Phone as blocked; the Phone FAQ says it may open on Android 10 and later,
with actual calls prohibited. This does not settle which restriction applied to
the earlier Pixel/Samsung returns to Home. Preserve those original negative
observations and keep dialer handoff/store-review evidence missing. A support
clarification is requested from the user, not sent without authorization.

- https://www.browserstack.com/support/faq/mobile/devices-amp-browsers/why-do-i-see-the-restriction-enabled-error-when-accessing-default-apps-on-browserstacks-mobile-devices
- https://www.browserstack.com/support/faq/mobile/devices-amp-browsers/can-i-use-the-phone-app-on-browserstack-devices

## Shared Environment

Current read-only Google API requests with the existing application-default
credential return: billing-account list HTTP 200 (three visible, none open),
staging project HTTP 403, production billing info HTTP 200 with billing enabled,
and the assigned production billing-account resource HTTP 403. The visible closed
accounts do not establish that production billing is closed. A 403 alone does
not establish whether staging exists. No account IDs or credential values are
retained in this report. The approved five-euro staging budget is not configured.

The separate CLI login needs reauthentication. Its initial Python interpreter also
has a missing SSL library; a per-command supported bundled interpreter establishes
the authentication failure without changing system Python or global CLI settings.
The current application-default credential remains able to make the reads above;
refreshing the CLI login would not by itself prove billing-link permissions.

These are prerequisite observations, not accepted tracking, payment or release
requirements. No infrastructure changed, so no Terraform apply was performed.
