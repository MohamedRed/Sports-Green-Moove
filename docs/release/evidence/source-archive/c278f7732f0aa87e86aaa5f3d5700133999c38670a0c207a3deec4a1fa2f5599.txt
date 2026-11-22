export const nativeTeamAlertSources=[
  'android/app/build.gradle.kts','android/app/src/main/AndroidManifest.xml',
  ...['TeamPushAlert.kt','TeamPushLifecycle.kt','TeamPushJournal.kt','TeamPushRegistration.kt',
    'AndroidTeamPushRuntime.kt','AndroidTeamPushNotification.kt','TeamPushDeliveryWorker.kt',
    'FirebaseAndroidTeamPushAlert.kt','FirebaseAndroidRuntime.kt','TeamPushMessagingService.kt','AndroidTeamPushPlatform.kt']
    .map(file=>'android/app/src/main/java/be/sportgreenmoove/app/services/'+file),
  ...['TeamPushOpenState.kt','TeamPushOpenRoute.kt','MessagesAppArea.kt','SportsGreenMooveApp.kt','AppAccessGate.kt']
    .map(file=>'android/app/src/main/java/be/sportgreenmoove/app/ui/'+file),
  'android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamPushOpenFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/services/TeamPushPlatformFlowTest.kt',
  'android/app/src/test/java/be/sportgreenmoove/app/services/TeamPushAlertTest.kt',
  'android/app/src/test/java/be/sportgreenmoove/app/ui/TeamPushOpenStateTest.kt',
  'scripts/qa/run-team-alert-components.mjs','scripts/qa/run-local-team-read-components-ui.mjs',
  'scripts/qa/disposable-notification-permission.mjs','scripts/qa/collect-local-ui-evidence.mjs',
  'scripts/qa/native-team-alert-sources.mjs',
  'scripts/qa/run-native-team-push-journal.mjs','functions/src/domain/teamPushAlert.ts',
];
export const nativeTeamAlertCases={TeamPushAlertTest:13,'ui.TeamPushOpenStateTest':7};
