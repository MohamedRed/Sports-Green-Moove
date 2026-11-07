# Privacy Policy URL Check

Generated at: 2026-06-17T15:41:45Z

Target URL: `https://sports-green-moove-prod.web.app/privacy`

Result: accepted.

Evidence:

- `npm run build --workspace admin` passed locally and generated the public privacy route in `admin/dist`.
- `firebase deploy --only hosting --project sports-green-moove-prod --non-interactive` still failed because the local Firebase CLI credentials require `firebase login --reauth`.
- The same built `admin/dist` bundle was deployed with the Firebase Hosting REST API using the active Google application-default credentials, following the official create-version, populate-files, upload, finalize, and release flow.
- Firebase Hosting version `sites/sports-green-moove-prod/versions/eb1fd8627d8aa1d2` was finalized with 6 files.
- Firebase Hosting release `sites/sports-green-moove-prod/releases/1781710861740000` was created at `2026-06-17T15:41:01.740Z`.
- `curl -I -L --max-time 30 https://sports-green-moove-prod.web.app/privacy` returned `HTTP/2 200`, `content-type: text/html; charset=utf-8`, and `last-modified: Wed, 17 Jun 2026 15:41:01 GMT`.
- `curl -I -L --max-time 30 https://sports-green-moove-prod.firebaseapp.com/privacy` also returned `HTTP/2 200`.
- The live HTML references `/assets/index-BhcaU17g.js`; that live bundle routes `/privacy` and `/privacy/` to `/assets/PrivacyPolicyPage-Cv04WHUW.js`.
- The live `/assets/PrivacyPolicyPage-Cv04WHUW.js` bundle contains the expected public policy content and processor coverage for Firebase, Meta, Radar, Google Maps Platform, Stripe Connect, guardian consent, child safety, active-ride location, deletion rights, and the 17 June 2026 update date.

Conclusion:

The production privacy policy URL is published and live-verified for store review. The Firebase CLI user credential still needs reauthentication for future CLI deploys, but the current Hosting release is deployed and accessible through both Firebase Hosting domains.
