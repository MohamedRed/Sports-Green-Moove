import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = read("android-appetize.yml", ".github/workflows/android-appetize.yml");
const releaseReadiness = read("release-readiness.yml", ".github/workflows/release-readiness.yml");
const packageJson = read("package.json", "package.json");

includes(workflow, "workflow_dispatch", "Android Appetize workflow can be launched manually.");
includes(workflow, "timeout-minutes: 25", "Android Appetize job has a CI-minute budget.");
includes(workflow, "timeout-minutes: 15", "Android Appetize Gradle build fails fast when it stalls.");
includes(workflow, "gradle/actions/setup-gradle@v4", "Android Appetize workflow uses Gradle caching.");
includes(workflow, ":app:assembleDebug --no-daemon --stacktrace --warning-mode all", "Android APK build keeps diagnostic output enabled.");
includes(workflow, "android-appetize-gradle-diagnostics", "Android Appetize workflow uploads diagnostics on failure.");
includes(workflow, "${{ failure() || cancelled() }}", "Android Appetize diagnostics run on failure or cancellation.");
includes(workflow, "sports-green-moove-debug-apk", "Android Appetize workflow uploads the built APK artifact.");
includes(workflow, "APPETIZE_API_TOKEN", "Android Appetize workflow uses the Appetize upload token.");
includes(workflow, "SGM_FACEBOOK_APP_ID", "Android Appetize build passes Facebook app id.");
includes(workflow, "SGM_FACEBOOK_CLIENT_TOKEN", "Android Appetize build passes Facebook client token.");
includes(workflow, "SGM_RADAR_PUBLISHABLE_KEY", "Android Appetize build passes Radar publishable key.");
includes(workflow, "SGM_GOOGLE_MAPS_ANDROID_API_KEY", "Android Appetize build passes Android Maps key.");

includes(releaseReadiness, ".github/workflows/android-appetize.yml", "Release Readiness reruns when Android Appetize changes.");
includes(releaseReadiness, "tests/android-appetize-workflow.test.mjs", "Release Readiness watches the Android Appetize workflow test.");
includes(releaseReadiness, "test:android-appetize-workflow", "Release Readiness validates Android Appetize workflow reliability.");
includes(packageJson, "test:android-appetize-workflow", "Package scripts expose Android Appetize workflow validation.");

console.log("Android Appetize workflow checks passed.");

function read(label, path) {
  const content = readFileSync(path, "utf8");
  assert.ok(content.length > 0, `${label} should not be empty.`);
  return content;
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), `${message}: missing ${needle}`);
}
