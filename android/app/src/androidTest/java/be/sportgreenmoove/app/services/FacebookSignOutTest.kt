package be.sportgreenmoove.app.services

import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.FacebookSdk
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import org.junit.Assert.assertFalse
import org.junit.Assume.assumeFalse
import org.junit.Test

class FacebookSignOutTest {
    @Test
    fun signOutDoesNotInitializeDisabledFacebookSdk() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assumeFalse("This regression runs with deferred Meta configuration", FacebookSdk.isInitialized())
        val app = FirebaseApp.initializeApp(
            context,
            FirebaseOptions.Builder()
                .setApplicationId("1:123456789:android:signout-test")
                .setApiKey("emulator-only-test-key")
                .setProjectId("demo-sgm-signout")
                .build(),
            "disabled-facebook-signout",
        )
        try {
            FirebaseAndroidFacebookSocialAuthGateway(context, FirebaseAuth.getInstance(app)).signOut()
            assertFalse(FacebookSdk.isInitialized())
        } finally {
            app.delete()
        }
    }
}
