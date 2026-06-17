export const requiredProviders = [
  "firebase",
  "radar",
  "googleMaps",
  "stripeConnect",
];

export const postponedSocialAuthProviders = ["googleSignIn", "metaFacebook"];

export const requiredDeviceScenarios = [
  "foreground_tracking",
  "background_tracking",
  "locked_screen_tracking",
  "gps_loss",
  "network_loss",
  "app_restart",
  "battery_saver",
  "radar_webhook_delay",
  "firebase_native_fallback",
];

export const requiredAutomatedFlowEvidence = [
  "native_ui_flow_ci",
  "android_connected_ui_ci",
  "backend_live_smoke",
  "operations_live_smoke",
  "firebase_rules_emulator",
  "stripe_webhook_emulator",
  "android_appetize_launch",
  "android_appetize_email_login",
];

export const requiredStoreEvidence = [
  "privacy_policy_url",
  "app_store_privacy_answers",
  "google_play_data_safety_answers",
  "guardian_consent_copy",
  "background_location_disclosure",
  "child_safety_disclosure",
  "active_ride_tracking_screenshot",
  "google_maps_route_preview_screenshot",
  "stale_location_warning_screenshot",
  "emergency_contact_action_screenshot",
  "permission_education_screenshot",
];

export const requiredAuditEvidence = [
  "guardian_consent_event",
  "pickup_event",
  "dropoff_event",
  "radar_webhook_event",
  "native_fallback_location_event",
  "payment_reconciliation_event",
];

export const requiredProviderEnvironmentVariables = [
  "FIREBASE_ANDROID_CONFIG_BASE64",
  "FIREBASE_IOS_CONFIG_BASE64",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "GOOGLE_MAPS_API_KEY",
  "SGM_GOOGLE_MAPS_ANDROID_API_KEY",
  "SGM_GOOGLE_MAPS_IOS_API_KEY",
  "RADAR_WEBHOOK_SECRET",
  "SGM_RADAR_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SGM_STRIPE_CONNECT_RETURN_URL",
  "SGM_STRIPE_CONNECT_REFRESH_URL",
];

export const postponedSocialAuthEnvironmentVariables = [
  "SGM_GOOGLE_REVERSED_CLIENT_ID",
  "SGM_FACEBOOK_APP_ID",
  "SGM_FACEBOOK_CLIENT_TOKEN",
];

export const requiredUserFlowChecks = [
  {
    workflowName: "Native CI",
    name: "Native UI flow coverage",
    acceptableConclusions: ["SUCCESS"],
  },
  {
    workflowName: "Native CI",
    name: "Android native unit tests",
    acceptableConclusions: ["SUCCESS"],
  },
  {
    workflowName: "Native CI",
    name: "Android native UI tests",
    acceptableConclusions: ["SUCCESS"],
  },
  {
    workflowName: "Backend CI",
    name: "Functions and Firebase rules",
    acceptableConclusions: ["SUCCESS"],
  },
  {
    workflowName: "Web Integration Smoke",
    name: "Functions, admin, and website smoke",
    acceptableConclusions: ["SUCCESS"],
  },
  {
    workflowName: "Release Readiness",
    name: "Store readiness static checks",
    acceptableConclusions: ["SUCCESS"],
  },
  {
    workflowName: "Native CI",
    name: "iOS native checks",
    acceptableConclusions: ["SUCCESS", "SKIPPED"],
  },
  {
    workflowName: "Native CI",
    name: "iOS native UI tests",
    acceptableConclusions: ["SUCCESS", "SKIPPED"],
  },
];
