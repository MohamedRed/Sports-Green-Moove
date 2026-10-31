# Access-key maintenance

The `Android BrowserStack Real-Device UI` workflow has a separate, manual
`rotate_access_key` operation. It never builds/uploads an app or starts a device.
The current key is used only to authenticate the account and rotate that key.

Generate a dedicated RSA recipient key pair (at least 3072 bits). Keep its private
key in the local process, never in the repository, command arguments or logs.
Dispatch once with the public PEM and a fresh UUID `rotation_request_id`, on
`codex/implement-plan`. Leave app-distribution confirmations false. The runner
uses only the two existing provider secrets and read-only repository permission.
It never receives the local GitHub credential.

The runner calls the provider rotation endpoint once, encrypts the new credential
in memory with AES-256-GCM and wraps that key with RSA-OAEP-SHA256. The identity
metadata is authenticated. Only ciphertext and a non-secret verification receipt
are uploaded, retained for one day. The receipt separately records the new key's
HTTP 200 and the old key's HTTP 401 against the read-only recent-apps endpoint.
No app records are printed or retained.

Download the artifact for that exact run and request ID. Verify its repository,
commit, run and request identities, then decrypt in the original local process.
Send the new value directly to `gh secret set BROWSERSTACK_ACCESS_KEY` through
standard input. Never print it, put it in command arguments or save plaintext.
Recheck the secret inventory update time and read-only provider authentication.
Destroy the in-memory recipient private key after the secret update is verified.

Do not retry a rotation after a timeout or ambiguous response. A failed later
verification can still have a valid encrypted artifact; recover that artifact
first. A lost recipient private key or missing rotation response requires account
recovery, not a blind repeated dispatch. Rotation interrupts other integrations
using the old key; update their existing secret storage before resuming tests.

References: [rotation API](https://www.browserstack.com/docs/automate/api-reference/selenium/key),
[read-only app inventory API](https://www.browserstack.com/app-live/rest-api).
