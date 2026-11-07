# Functional Pass With Rejected Display Captures

This original Android case passed in 74.446 seconds. Its host also verified the
stored point, baseline isolation, mock-permission restoration, package removal,
successful emulator shutdown, temporary-directory removal and closed service
endpoints. Those original results are retained without modification.

Visual review rejected two native-display images because the bottom navigation
was not included in their visible composition. This set is not accepted for the
partner portal. A native screenshot can differ from the synchronized application
window even after a frame has been submitted; frame commit does not itself prove
presentation on the physical display.

The replacement primary method copies the exact Compose root rectangle from its
own window using PixelCopy, waits once for its callback with a ten-second bound,
and fails on any non-success result. It has no alternate capture path or retry.
The expected screen remains asserted before and after capture. The shared
capture helper and all application assertions remain unchanged.
