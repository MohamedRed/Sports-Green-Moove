# Authorized service-token rotation

The user explicitly approved renewing the exposed Site service token on
4 November 2026. The native rotation operation returned a different token;
subsequent Site state confirmed the new current value and unchanged public access.
Only boolean results and the exact Site ID are recorded in `receipt.json`.

During this rotation, no token value, prefix or digest was written to files,
source, output or the portal.
The service may retain a short grace period for the previous token. This receipt
does not claim that an old authenticated request was independently rejected;
anonymous public access cannot establish that distinction.
