import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

val radarPublishableKey = providers
    .gradleProperty("SGM_RADAR_PUBLISHABLE_KEY")
    .orElse(providers.environmentVariable("SGM_RADAR_PUBLISHABLE_KEY"))
    .getOrElse("")
val stripeConnectReturnUrl = providers
    .gradleProperty("SGM_STRIPE_CONNECT_RETURN_URL")
    .orElse(providers.environmentVariable("SGM_STRIPE_CONNECT_RETURN_URL"))
    .getOrElse("")
val stripeConnectRefreshUrl = providers
    .gradleProperty("SGM_STRIPE_CONNECT_REFRESH_URL")
    .orElse(providers.environmentVariable("SGM_STRIPE_CONNECT_REFRESH_URL"))
    .getOrElse("")
val facebookAppId = providers
    .gradleProperty("SGM_FACEBOOK_APP_ID")
    .orElse(providers.environmentVariable("SGM_FACEBOOK_APP_ID"))
    .getOrElse("")
val facebookClientToken = providers
    .gradleProperty("SGM_FACEBOOK_CLIENT_TOKEN")
    .orElse(providers.environmentVariable("SGM_FACEBOOK_CLIENT_TOKEN"))
    .getOrElse("")
val facebookLoginProtocolScheme = facebookAppId.takeIf(String::isNotBlank)?.let { "fb$it" } ?: ""
val googleMapsAndroidApiKey = providers
    .gradleProperty("SGM_GOOGLE_MAPS_ANDROID_API_KEY")
    .orElse(providers.environmentVariable("SGM_GOOGLE_MAPS_ANDROID_API_KEY"))
    .getOrElse("")

android {
    namespace = "be.sportgreenmoove.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "be.sportgreenmoove.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        resValue("string", "sgm_radar_publishable_key", radarPublishableKey)
        resValue("string", "sgm_stripe_connect_return_url", stripeConnectReturnUrl)
        resValue("string", "sgm_stripe_connect_refresh_url", stripeConnectRefreshUrl)
        resValue("string", "facebook_app_id", facebookAppId)
        resValue("string", "facebook_client_token", facebookClientToken)
        resValue("string", "fb_login_protocol_scheme", facebookLoginProtocolScheme)
        resValue("string", "sgm_google_maps_android_api_key", googleMapsAndroidApiKey)
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.05.00")
    val firebaseBom = platform("com.google.firebase:firebase-bom:34.14.1")
    implementation(composeBom)
    implementation(firebaseBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-database")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-functions")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("com.google.android.gms:play-services-maps:20.0.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("com.google.maps.android:maps-compose:8.3.0")
    implementation("com.facebook.android:facebook-login:18.2.3")
    implementation("io.radar:sdk:3.34.0")
    implementation("com.stripe:stripe-android:23.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")

    testImplementation("junit:junit:4.13.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
