# Android Phone access on BrowserStack App Live

On 17 November 2026, the authenticated App Live dashboard launched a Google
Pixel 9 Pro on Android 15 in a No SIM session with the previously uploaded
isolated `sgm-notification-retry-local.apk`.

1. The Home shortcut left the launcher visible. The labelled Phone app in
   the app drawer returned the device to Home.
2. The same launcher opened the selected Sports Green-Moove test app to its
   sign-in screen. This verified that an app could be opened by tapping.
3. Stop Session returned to the uploaded-app dashboard.

No number was entered or called. The app stayed signed out and no tunnel was
connected. The in-app handoff and its store capture remain pending. The prior
[Samsung device test](../emergency-dialer-samsung-2026-10-24/README.md) also
returned to Home.

BrowserStack publishes separate guidance on [default app restrictions](https://www.browserstack.com/support/faq/mobile/devices-amp-browsers/why-do-i-see-the-restriction-enabled-error-when-accessing-default-apps-on-browserstacks-mobile-devices)
and [Phone availability](https://www.browserstack.com/support/faq/mobile/devices-amp-browsers/can-i-use-the-phone-app-on-browserstack-devices).
Confirm that the exact device session can show the system dialer before
attempting the app’s emergency handoff.
