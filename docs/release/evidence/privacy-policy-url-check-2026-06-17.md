# Privacy Policy URL Check

Generated at: 2026-06-17T15:02:17Z

Target URL: `https://sports-green-moove-prod.web.app/privacy`

Result: pending.

Evidence:

- `curl -sS -L -D /tmp/sgm-privacy.headers -o /tmp/sgm-privacy.html https://sports-green-moove-prod.web.app/privacy` completed successfully at the transport layer, but Firebase Hosting returned `HTTP/2 404`.
- The response body was the Firebase Hosting `Site Not Found` page, not the Sports Green-Moove privacy policy.
- `npm run build --workspace admin` passed locally and generated the public privacy route in `admin/dist`.
- `npm run test:privacy-policy-page` passed locally.
- `firebase deploy --only hosting --project sports-green-moove-prod --non-interactive` could not publish the hosting bundle because the local Firebase CLI credentials are expired and require `firebase login --reauth`.

Conclusion:

The `/privacy` implementation is buildable and locally validated, but the production store-review URL must remain pending until Firebase credentials are reauthenticated and a hosting-only deploy succeeds.
