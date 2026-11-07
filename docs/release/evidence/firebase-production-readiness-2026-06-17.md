# Firebase Production Readiness - 2026-06-17

## Scope

This evidence covers Firebase production readiness for the Android
email/password release scope. It does not cover Google Sign-In or Meta
Facebook Login, which remain postponed.

## Evidence

- Production provider secret validation passed in Release Readiness job
  https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/27723144572/job/82013229825.
- Production backend live smoke passed with disposable users and cleanup:
  `codex-smoke-2026-06-17T22-09-51-162Z-373f27f6`.
- Production operations live smoke passed with disposable users and cleanup:
  `codex-ops-smoke-2026-06-17T22-11-41-606Z-029cf779`.
- Live smoke coverage included Firebase Auth email/password signup/signin,
  custom claims, Cloud Functions, Firestore, Realtime Database native fallback,
  chat, reports, ratings, and cleanup.
- Backend CI passed Firebase rules emulator coverage for Firestore, Realtime
  Database, and Storage.
- Firebase Hosting privacy URL was published and live-verified at
  `https://sports-green-moove-prod.web.app/privacy` and
  `https://sports-green-moove-prod.firebaseapp.com/privacy`.

## Remaining Firebase Notes

The local Firebase CLI user credential still requires `firebase login --reauth`
for future CLI deploys. Current evidence used Google application-default
credentials and GitHub Actions secrets, not committed secret values.
