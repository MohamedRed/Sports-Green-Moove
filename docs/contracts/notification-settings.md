# Android Notification Settings

The profile and Options must read this app's current system notification
permission. A fixed enabled label is not evidence of permission or delivery.
The same control is used in both screens; it opens only the current package's
notification settings. Resuming the screen rereads permission without requiring
a sign-out or app restart. The app does not grant, revoke or cache permission.

An unavailable or denied settings activity shows an explicit error. There is no
alternate activity, implicit permission request, or optimistic permission change.
The two-line control and opening errors must fit narrow/large-text layouts.

`NotificationManager.areNotificationsEnabled()` reports the app-wide permission,
not provider delivery, every notification-channel setting, Do Not Disturb,
background execution, urgent support emails or iOS readiness. These remain
separate tests. No location permission or tracking policy is changed here.

References: [app notification settings](https://developer.android.com/reference/android/provider/Settings#ACTION_APP_NOTIFICATION_SETTINGS),
[notification permission](https://developer.android.com/reference/android/app/NotificationManager#areNotificationsEnabled()).

Verification has four distinct scopes: the original failing static-label check,
JVM state tests, compiled native component/platform tests, and actual physical
phone navigation/permission changes. Do not promote compilation to native
execution. The isolated account observer only proves record/claim integrity;
phone screenshots and observed actions prove the OS/app transitions separately.
