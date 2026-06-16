import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const flows = [
  { label: "auth screen", value: "auth.screen", android: "AuthScreen", ios: "authScreen" },
  { label: "email auth action", value: "auth.email.action", android: "AuthEmailAction", ios: "authEmailAction" },
  { label: "Facebook auth action", value: "auth.facebook.action", android: "AuthFacebookAction", ios: "authFacebookAction" },
  { label: "Google auth action", value: "auth.google.action", android: "AuthGoogleAction", ios: "authGoogleAction" },
  { label: "configuration-required screen", value: "configuration.required", android: "ConfigurationRequired", ios: "configurationRequired" },
  { label: "home screen", value: "home.screen", android: "HomeScreen", ios: "homeScreen" },
  { label: "groups screen", value: "groups.screen", android: "GroupsScreen", ios: "groupsScreen" },
  { label: "groups join action", value: "groups.join.action", android: "GroupsJoinAction", ios: "groupsJoinAction" },
  { label: "publish screen", value: "publish.screen", android: "PublishScreen", ios: "publishScreen" },
  { label: "publish next action", value: "publish.next.action", android: "PublishNextAction", ios: "publishNextAction" },
  { label: "publish submit action", value: "publish.submit.action", android: "PublishSubmitAction", ios: "publishSubmitAction" },
  { label: "search screen", value: "search.screen", android: "SearchScreen", ios: "searchScreen" },
  { label: "search action", value: "search.action", android: "SearchAction", ios: "searchAction" },
  { label: "booking request action", value: "booking.request.action", android: "BookingRequestAction", ios: "bookingRequestAction" },
  { label: "booking approve action", value: "booking.approve.action", android: "BookingApproveAction", ios: "bookingApproveAction" },
  { label: "active ride screen", value: "active-ride.screen", android: "ActiveRideScreen", ios: "activeRideScreen" },
  { label: "active ride pickup action", value: "active-ride.pickup.action", android: "ActiveRidePickupAction", ios: "activeRidePickupAction" },
  { label: "active ride dropoff action", value: "active-ride.dropoff.action", android: "ActiveRideDropoffAction", ios: "activeRideDropoffAction" },
  { label: "active ride end action", value: "active-ride.end.action", android: "ActiveRideEndAction", ios: "activeRideEndAction" },
  { label: "emergency contact surface", value: "active-ride.emergency-contact", android: "EmergencyContact", ios: "emergencyContact" },
  { label: "messages screen", value: "messages.screen", android: "MessagesScreen", ios: "messagesScreen" },
  { label: "chat tab", value: "messages.chat.tab", android: "ChatTab", ios: "chatTab" },
  { label: "rating tab", value: "messages.rating.tab", android: "RatingTab", ios: "ratingTab" },
  { label: "rating prompt action", value: "messages.rating-prompt.action", android: "RatingPromptAction", ios: "ratingPromptAction" },
  { label: "CO2 impact screen", value: "impact.screen", android: "ImpactScreen", ios: "impactScreen" },
  { label: "rewards screen", value: "rewards.screen", android: "RewardsScreen", ios: "rewardsScreen" },
  { label: "rewards withdrawal action", value: "rewards.withdraw.action", android: "RewardsWithdrawAction", ios: "rewardsWithdrawAction" },
  { label: "options screen", value: "options.screen", android: "OptionsScreen", ios: "optionsScreen" },
  { label: "support report action", value: "options.support-report.action", android: "SupportReportAction", ios: "supportReportAction" },
  { label: "payments screen", value: "payments.screen", android: "PaymentsScreen", ios: "paymentsScreen" },
  { label: "payment action", value: "payments.payment.action", android: "PaymentAction", ios: "paymentAction" },
];

const androidUiDir = path.join(rootDir, "android/app/src/main/java/be/sportgreenmoove/app/ui");
const iosSourceDir = path.join(rootDir, "ios/Sources/SportsGreenMooveApp");

const androidRegistry = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/SgmTestTags.kt");
const iosRegistry = readFile("ios/Sources/SportsGreenMooveApp/UITestIdentifiers.swift");
const androidSources = sourceCorpus(androidUiDir, ".kt", "SgmTestTags.kt");
const iosSources = sourceCorpus(iosSourceDir, ".swift", "UITestIdentifiers.swift");
const androidUiTests = sourceCorpus(
  path.join(rootDir, "android/app/src/androidTest/java/be/sportgreenmoove/app/ui"),
  ".kt",
);
const iosUiTests = readFile("ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift");
const iosProject = readFile("ios/project.yml");
const nativeCi = readFile(".github/workflows/native-ci.yml");
const androidHomeCards = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/HomeCards.kt");
const androidRideActions = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveRideActions.kt");
const androidActiveRideStartup = readFile("android/app/src/main/java/be/sportgreenmoove/app/services/ActiveRideStartup.kt");
const androidAppState = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt");
const androidClubMembershipActions = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/ClubMembershipActions.kt");
const androidGroups = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/GroupsScreen.kt");
const androidGroupsRoute = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/GroupsRoute.kt");
const androidGroupsGateway = readFile("android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGroupsGateway.kt");
const androidPublish = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/PublishScreen.kt");
const androidPublishFactory = readFile("android/app/src/main/java/be/sportgreenmoove/app/domain/PublishDraftFactory.kt");
const androidImpact = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/ImpactScreen.kt");
const androidRewards = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/RewardsScreen.kt");
const androidLedgerGateway = readFile("android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidLedgerGateway.kt");
const androidProfile = readFile("android/app/src/main/java/be/sportgreenmoove/app/ui/ProfileScreen.kt");
const iosGroups = readFile("ios/Sources/SportsGreenMooveApp/GroupsScreen.swift");
const iosGroupsGateway = readFile("ios/Sources/SportsGreenMooveApp/FirebaseClubSummaries.swift");
const iosHome = readFile("ios/Sources/SportsGreenMooveApp/HomeScreen.swift");
const iosImpactRewards = readFile("ios/Sources/SportsGreenMooveApp/ImpactRewardsScreens.swift");
const iosLedgerGateway = readFile("ios/Sources/SportsGreenMooveApp/FirebaseImpactRewards.swift");
const iosProfile = readFile("ios/Sources/SportsGreenMooveApp/ProfileScreen.swift");
const iosAppState = readFile("ios/Sources/SportsGreenMooveApp/AppState.swift");
const iosActiveRideStartup = readFile("ios/Sources/SportsGreenMooveApp/ActiveRideStartup.swift");
const iosRideLifecycle = readFile("ios/Sources/SportsGreenMooveApp/AppStateRideLifecycle.swift");

for (const flow of flows) {
  includes(
    androidRegistry,
    `const val ${flow.android} = "${flow.value}"`,
    `Android registry defines ${flow.label}`,
  );
  includes(
    iosRegistry,
    `static let ${flow.ios} = "${flow.value}"`,
    `iOS registry defines ${flow.label}`,
  );
  includes(
    androidSources,
    `SgmTestTags.${flow.android}`,
    `Android UI uses ${flow.label}`,
  );
  includes(
    iosSources,
    `UITestIdentifier.${flow.ios}`,
    `iOS UI uses ${flow.label}`,
  );
}

includes(androidUiTests, "createComposeRule", "Android uses Compose UI automation");
includes(androidUiTests, "SgmTestTags.ActiveRideScreen", "Android UI tests cover active ride selectors");
includes(androidUiTests, "SgmTestTags.PublishSubmitAction", "Android UI tests cover publish submit selectors");
includes(androidUiTests, "class SportsGreenMooveActionFlowTest", "Android UI tests include action-flow callback coverage");
includes(androidUiTests, "onSearch = { searchForm = it }", "Android UI tests assert search action callbacks");
includes(androidUiTests, "onRequest = { match, childId ->", "Android UI tests assert booking request callbacks");
includes(androidUiTests, "onPickup = { pickupPassenger = it }", "Android UI tests assert active ride pickup callbacks");
includes(androidUiTests, "onPay = { paidBooking = it }", "Android UI tests assert payment callbacks");
includes(iosUiTests, "XCUIApplication", "iOS uses XCUITest automation");
includes(iosUiTests, "--sgm-ui-test-fixture", "iOS UI tests launch deterministic fixture mode");
includes(iosUiTests, "\"publish.submit.action\"", "iOS UI tests cover publish submit selectors");
includes(iosProject, "SportsGreenMooveUITests:", "iOS project declares UI test target");
includes(iosProject, "type: bundle.ui-testing", "iOS UI test target uses XCUITest bundle type");
includes(nativeCi, "connectedDebugAndroidTest", "Native CI runs Android UI tests");
includes(nativeCi, "xcodebuild test", "Native CI runs iOS UI tests");
includes(androidGroups, "clubs: List<ClubSummary>", "Android Groups screen renders Firebase club summaries");
includes(androidGroups, "onJoinClub: (ClubSummary) -> Unit", "Android Groups join delegates to the app Firebase action");
includes(androidAppState, "GroupsRoute(", "Android app state opens the backend-backed Groups route");
includes(androidGroupsRoute, "launchClubMembershipRequest(", "Android Groups route launches a backend-backed club membership request action");
includes(androidClubMembershipActions, "providers.firebase.requestClubMembership(club.id)", "Android club membership action calls Firebase");
includes(androidGroupsGateway, 'collection("clubs")', "Android Groups gateway reads clubs");
includes(androidGroupsGateway, 'collection("memberships")', "Android Groups gateway reads memberships");
notIncludes(androidGroups, "private val MyClubs", "Android Groups screen must not embed member club fixtures");
notIncludes(androidGroups, "private val SuggestedClubs", "Android Groups screen must not embed suggested club fixtures");
notIncludes(androidGroups, "mutableStateOf(setOf", "Android Groups join must not use local-only requested state");
includes(androidPublish, "memberClubs: List<ClubSummary>", "Android Publish screen receives Firebase member club context");
includes(androidPublishFactory, "clubId = club.id", "Android Publish draft uses selected member club id");
notIncludes(androidPublish, "Royal Ottignies", "Android Publish screen must not embed a static club identity");
notIncludes(androidPublishFactory, "Royal Ottignies", "Android Publish draft factory must not embed a static club identity");
includes(iosGroups, "appState.clubSummaries", "iOS Groups screen renders Firebase club summaries");
includes(iosGroupsGateway, '.collection("clubs")', "iOS Groups gateway reads clubs");
includes(iosGroupsGateway, '.collection("memberships")', "iOS Groups gateway reads memberships");
notIncludes(iosGroups, "Royal Ottignies", "iOS Groups screen must not embed club fixtures");
notIncludes(iosGroups, "Collège du Biéreau", "iOS Groups screen must not embed club fixtures");
includes(androidProfile, "primaryClubLabel", "Android Profile reads the primary club label from app state");
notIncludes(androidProfile, "Olivier · Collège du Biéreau", "Android Profile must not embed a static club identity");
includes(iosProfile, "clubSummaries.first", "iOS Profile reads the primary club from app state");
notIncludes(iosProfile, "Olivier · Collège du Biéreau", "iOS Profile must not embed a static club identity");
includes(androidLedgerGateway, 'collection("co2Ledger")', "Android ledger gateway reads CO2 ledger");
includes(androidLedgerGateway, 'collection("rewardLedger")', "Android ledger gateway reads reward ledger");
includes(androidHomeCards, "summary: ImpactSummary", "Android Home dashboard renders impact summary");
includes(androidImpact, "summary: ImpactSummary", "Android Impact screen renders injected ledger summary");
includes(androidRewards, "summary: RewardSummary", "Android Rewards screen renders injected ledger summary");
notIncludes(androidHomeCards, "12,4", "Android Home dashboard must not embed a static CO2 total");
notIncludes(androidHomeCards, "37.356", "Android Home dashboard must not embed static regional counts");
notIncludes(androidImpact, "12.4", "Android Impact screen must not embed a static CO2 total");
notIncludes(androidImpact, "37 356", "Android Impact screen must not embed static regional CO2 values");
notIncludes(androidRewards, "7.50", "Android Rewards screen must not embed a static balance");
notIncludes(androidRewards, "U8 vs Royal", "Android Rewards screen must not embed static reward events");
notIncludes(androidProfile, "Rang #47 Belgique", "Android Profile must not embed static impact ranking");
notIncludes(androidProfile, "7.50€", "Android Profile must not embed a static reward balance");
includes(iosLedgerGateway, '.collection("co2Ledger")', "iOS ledger gateway reads CO2 ledger");
includes(iosLedgerGateway, '.collection("rewardLedger")', "iOS ledger gateway reads reward ledger");
includes(iosHome, "appState.impactSummary", "iOS Home dashboard renders impact summary");
includes(iosImpactRewards, "appState.impactSummary", "iOS Impact screen renders app ledger summary");
includes(iosImpactRewards, "appState.rewardSummary", "iOS Rewards screen renders app ledger summary");
notIncludes(iosHome, "12.4", "iOS Home dashboard must not embed a static CO2 total");
notIncludes(iosHome, "Wallonie · Flandre · Bruxelles", "iOS Home dashboard must not embed static regional copy");
notIncludes(iosImpactRewards, "37 356", "iOS Impact screen must not embed static regional CO2 values");
notIncludes(iosImpactRewards, "7.50", "iOS Rewards screen must not embed a static balance");
notIncludes(iosImpactRewards, "U8 Nationaux", "iOS Rewards screen must not embed static reward events");
notIncludes(iosProfile, "Rang #47 Belgique", "iOS Profile must not embed static impact ranking");
notIncludes(iosProfile, "7.50€", "iOS Profile must not embed a static reward balance");
includes(androidActiveRideStartup, "startAccessibleRideTracking", "Android can attach tracking to an accessible active ride");
includes(androidRideActions, "AppRole.Child", "Android child role has an active ride tracking branch");
includes(androidRideActions, "providers.startAccessibleRideTracking(role)", "Android child branch starts child-device tracking");
includes(iosActiveRideStartup, "startAccessibleRideTracking", "iOS can attach tracking to an accessible active ride");
includes(iosAppState, "selectedRole == .child", "iOS child role has an active ride tracking branch");
includes(iosRideLifecycle, "startAccessibleRideTracking(", "iOS child branch starts child-device tracking");

console.log(`Validated ${flows.length} native UI flow identifiers on Android and iOS.`);

function readFile(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function sourceCorpus(dir, extension, excludedFile) {
  return walk(dir)
    .filter((file) => file.endsWith(extension) && path.basename(file) !== excludedFile)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function walk(dir) {
  const entries = readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) return walk(fullPath);
    return [fullPath];
  });
  return entries;
}

function includes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(`${message}: missing ${needle}`);
  }
}

function notIncludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    throw new Error(`${message}: unexpected ${needle}`);
  }
}
