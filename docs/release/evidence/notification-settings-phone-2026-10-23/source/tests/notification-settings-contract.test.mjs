import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = file => readFileSync('android/app/src/main/java/be/sportgreenmoove/app/' + file, 'utf8');
test('profile and options do not invent notification permission or send the user to unrelated settings', () => {
  const profile = source('ui/ProfileScreen.kt') + source('ui/ProfileSettingsCard.kt'), options = source('ui/OptionsScreen.kt');
  assert.doesNotMatch(profile + options, /(?:ProfileSetting|OptionRow)\(SgmIcon\.Bell, "Notifications", "Activées"/);
  assert.match(profile, /NotificationSettingsRow\(showDivider = true\)/);
  assert.match(options, /if \(includeNotifications\) NotificationSettingsRow\(\)/);
});
test('the platform opens only this apps notification settings, without permission mutation or fallback', () => {
  const platform = source('services/AndroidNotificationSettings.kt'), row = source('ui/NotificationSettingsRow.kt');
  assert.match(platform, /NotificationManager::class\.java\)\.areNotificationsEnabled\(\)/);
  assert.match(platform, /Intent\(Settings\.ACTION_APP_NOTIFICATION_SETTINGS\)\.putExtra\(Settings\.EXTRA_APP_PACKAGE, packageName\)/);
  assert.equal((platform.match(/context\.startActivity\(/g) ?? []).length, 1);
  assert.doesNotMatch(platform + row, /requestPermissions|ACTION_APPLICATION_DETAILS_SETTINGS|ACTION_SETTINGS|POST_NOTIFICATIONS/);
  assert.match(row, /Lifecycle\.Event\.ON_RESUME\) state\.refresh\(\)/);
  assert.match(row, /onDispose \{ owner\.lifecycle\.removeObserver\(observer\) \}/);
});
test('the phone records observer does not mutate fixtures during observed settings changes', () => {
  const controller = readFileSync('scripts/qa/observe-notification-phone-records.mjs', 'utf8');
  const loop = controller.slice(controller.indexOf('for await (const command'), controller.indexOf('} catch (error)'));
  assert.doesNotMatch(loop, /\.(?:set|update|delete)\(|await call\(|grant|revoke|createTrip|requestBooking/);
  assert.match(controller, /osPermissionProvenByThisObserver: false/);
  assert.match(controller, /pushDeliveryAccepted: false/);
});
