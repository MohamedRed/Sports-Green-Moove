# Completed Local Startup Case, Incomplete Visual Coverage

The original Android case passed in 124.86 seconds with actual local app/SDK and
authenticated callable calls. A stored duplicate starts sensing, a future capture
does not, a subsequent valid explicit resume clears the previous error, and
sign-out stops the foreground service. The host verifies the exact stored capture,
unchanged baseline flow records and other live rides, restored mock permission,
closed admin client, removed local packages, successful emulator exit, deleted
owned runtime directory and closed local service endpoints.

All four original captures and their exact source are retained. Visual review
accepts only `started` and `signed-out` for the partner portal. Navigation is absent
from the `invalid` and `resumed` images, despite the test assertions and later
navigation succeeding. Enabling hardware rendering and invalidating the decor did
not fully resolve this discrepancy. Whether this is a capture/rendering problem
or actual app presentation remains unproven. It is an explicit remaining issue,
not an accepted visual-completeness or responsive-layout result. The portal shows
only the two reviewed usable images and reports the missing visual coverage.

This is one independent synthetic local functional case, not a full native suite,
physical GPS, map movement, locked/background tracking, provider delivery, actual
network loss, safety-audit acceptance or release readiness. The latest full replay
remains interrupted by the separately retained startup ANR. Earlier cleanup,
acquisition, copy and visual-review failures remain unchanged negative evidence.

The matching backend is not deployed. External app distribution stays gated on
backend readiness and credential rotation. No production data or billing changed.
