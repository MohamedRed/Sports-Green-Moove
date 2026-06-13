# Auth Contract

Firebase Auth custom claims are the trusted source for security-rule role checks.
The `users/{uid}.roles` map is profile data for the app UI and admin console; it
must not be used by clients as proof of authorization.

Native clients support Firebase email/password authentication, Google federated
authentication, and Facebook federated authentication. Android obtains the Google
ID token through Credential Manager and the `default_web_client_id` generated
from `google-services.json`. iOS obtains the Google ID token through
GoogleSignIn, uses the Firebase client id from `GoogleService-Info.plist`, and
requires `SGM_GOOGLE_REVERSED_CLIENT_ID` in the build settings so the redirect
URL scheme is explicit. Facebook sign-in uses the native Meta Login SDK on both
platforms, exchanges the Meta access token with Firebase Auth, and requires
`SGM_FACEBOOK_APP_ID` plus `SGM_FACEBOOK_CLIENT_TOKEN` at build time.

Every issued token must include `roleKeys`, the rule-facing list of active
roles:

```json
{
  "roleKeys": ["driver", "parent"]
}
```

The profile document keeps the complete role map for UI display:

```json
{
  "roles": {
    "admin": false,
    "child": false,
    "clubManager": false,
    "driver": true,
    "parent": true
  }
}
```

Rules currently check `roleKeys` for `admin` and `clubManager`. Functions that
promote or remove roles must update both the custom claims and the matching
`users/{uid}.roles` profile snapshot in the same admin-owned workflow.
