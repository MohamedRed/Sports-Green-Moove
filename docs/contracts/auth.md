# Auth Contract

Firebase Auth custom claims are the trusted source for security-rule role checks.
The `users/{uid}.roles` map is profile data for the app UI and admin console; it
must not be used by clients as proof of authorization.

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
