plugins { id("com.android.application") }
android {
    namespace = "be.sportgreenmoove.qa.connectivity"
    compileSdk = 36
    defaultConfig { applicationId = "be.sportgreenmoove.qa.connectivity"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "1" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
