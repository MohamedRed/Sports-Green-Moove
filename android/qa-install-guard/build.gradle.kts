import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "be.sportgreenmoove.qa.installguard"
    compileSdk = 36
    defaultConfig {
        applicationId = "be.sportgreenmoove.qa.installguard"
        minSdk = 35
        targetSdk = 35
        versionCode = 1
        versionName = "1"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin.compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

androidComponents {
    beforeVariants(selector().withBuildType("release")) { it.enable = false }
}
