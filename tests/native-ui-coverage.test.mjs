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
const androidUiTests = readFile("android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SportsGreenMooveUiFlowTest.kt");
const iosUiTests = readFile("ios/UITests/SportsGreenMooveUITests/SportsGreenMooveUITests.swift");
const iosProject = readFile("ios/project.yml");
const nativeCi = readFile(".github/workflows/native-ci.yml");

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
includes(iosUiTests, "XCUIApplication", "iOS uses XCUITest automation");
includes(iosUiTests, "--sgm-ui-test-fixture", "iOS UI tests launch deterministic fixture mode");
includes(iosUiTests, "\"publish.submit.action\"", "iOS UI tests cover publish submit selectors");
includes(iosProject, "SportsGreenMooveUITests:", "iOS project declares UI test target");
includes(iosProject, "type: bundle.ui-testing", "iOS UI test target uses XCUITest bundle type");
includes(nativeCi, "connectedDebugAndroidTest", "Native CI runs Android UI tests");
includes(nativeCi, "xcodebuild test", "Native CI runs iOS UI tests");

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
