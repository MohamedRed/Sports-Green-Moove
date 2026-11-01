const main = 'android/app/src/main/java/be/sportgreenmoove/app/services/';
const unit = 'android/app/src/test/java/be/sportgreenmoove/app/services/';
export const nativeTeamPushSources = [
  ...['TeamPushRegistration.kt', 'TeamPushJournal.kt', 'TeamPushRecordCodec.kt', 'FileTeamPushStorage.kt',
    'AndroidTeamPushJournal.kt', 'FirebaseAndroidTeamPushRegistration.kt'].map(file => main + file),
  ...['TeamPushJournalTest.kt', 'TeamPushStorageTest.kt', 'TeamPushRegistrationWireTest.kt'].map(file => unit + file),
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamPushPrivateStorageTest.kt',
  'android/app/build.gradle.kts', 'android/app/src/main/AndroidManifest.xml',
  'functions/src/domain/teamPushRegistration.ts', 'functions/src/domain/chatReference.ts',
];
export const nativeTeamPushCases = {TeamPushJournalTest: 15, TeamPushStorageTest: 6, TeamPushRegistrationWireTest: 6};
export const nativeTeamPushLifecycleSources = [...nativeTeamPushSources,
  ...['TeamPushLifecycle.kt', 'AndroidTeamPushRuntime.kt', 'AndroidTeamPushPlatform.kt',
    'QueuedTeamPushTokenSource.kt', 'TeamPushMessagingService.kt', 'FirebaseAndroidRuntime.kt'].map(file => main + file),
  ...['TeamPushLifecycleTest.kt', 'QueuedTeamPushTokenSourceTest.kt'].map(file => unit + file),
  'android/app/src/main/java/be/sportgreenmoove/app/SgmApplication.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt',
  'android/app/src/localDebug/AndroidManifest.xml',
];
export const nativeTeamPushLifecycleCases = {...nativeTeamPushCases, TeamPushLifecycleTest: 21, QueuedTeamPushTokenSourceTest: 3};
