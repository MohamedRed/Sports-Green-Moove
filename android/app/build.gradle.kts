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
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.1")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-database")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-functions")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("io.radar:sdk:3.34.0")
    implementation("com.stripe:stripe-android:23.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
