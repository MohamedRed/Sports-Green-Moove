package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmGridTexture
import be.sportgreenmoove.app.design.SgmType

@Composable
fun OnboardingScreen(
    loading: Boolean,
    error: String?,
    onSubmit: (OnboardingMode, String, String, String) -> Unit,
    onGoogle: () -> Unit,
    onFacebook: () -> Unit,
) {
    var mode by remember { mutableStateOf(OnboardingMode.Login) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var club by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().sgmTestTag(SgmTestTags.AuthScreen).background(Sgm.colors.bgApp)) {
        OnboardingHero()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 20.dp, top = 18.dp, end = 20.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OnboardingModeTab("SE CONNECTER", selected = mode == OnboardingMode.Login, onClick = { mode = OnboardingMode.Login }, modifier = Modifier.weight(1f))
                OnboardingModeTab("S'INSCRIRE", selected = mode == OnboardingMode.SignUp, onClick = { mode = OnboardingMode.SignUp }, modifier = Modifier.weight(1f))
            }
            if (mode == OnboardingMode.SignUp) OnboardingInput("Nom et prénom", name, { name = it })
            OnboardingInput("votre@email.be", email, { email = it })
            OnboardingInput("Mot de passe", password, { password = it })
            if (mode == OnboardingMode.SignUp) OnboardingInput("Votre club (ex: Collège du Biéreau)", club, { club = it })
            if (error != null) {
                Text(error, style = SgmType.BodyXS.copy(color = SgmColor.Orange, fontSize = 12.sp, fontWeight = FontWeight.Bold))
            }
            V2Button(
                if (loading) "CHARGEMENT" else if (mode == OnboardingMode.Login) "SE CONNECTER" else "CRÉER MON COMPTE",
                onClick = { onSubmit(mode, name, email, password) },
                full = true,
                size = V2ButtonSize.Lg,
                testTag = SgmTestTags.AuthEmailAction,
            )
            OnboardingDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OnboardingSocialButton("Facebook", onFacebook, Modifier.weight(1f), SgmTestTags.AuthFacebookAction)
                OnboardingSocialButton("Google", onGoogle, Modifier.weight(1f), SgmTestTags.AuthGoogleAction)
            }
            Spacer(Modifier.weight(1f))
            Text(
                "112 000+ greens-moovers en Belgique · Wallonie · Flandre · Bruxelles",
                style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.Medium),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
}

enum class OnboardingMode {
    Login,
    SignUp,
}

@Composable
fun ConfigurationRequiredScreen() {
    V2Screen(testTag = SgmTestTags.ConfigurationRequired) {
        V2TopBar("CONFIGURATION")
        Column(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Sgm.colors.bgCard)
                .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(18.dp))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("FIREBASE REQUIS", style = SgmType.DisplayXL.copy(color = Sgm.colors.textPrimary, fontSize = 26.sp, letterSpacing = 0.08.em))
            Text(
                "Ajoutez google-services.json dans android/app pour activer Auth, Firestore et Cloud Functions.",
                style = SgmType.BodySM.copy(color = Sgm.colors.textSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium),
            )
        }
    }
}

@Composable
private fun OnboardingHero() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(SgmColor.HeroGradient)
            .padding(start = 24.dp, top = 40.dp, end = 24.dp, bottom = 30.dp),
        contentAlignment = Alignment.Center,
    ) {
        SgmGridTexture()
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            OnboardingWordmark()
            Text("COVOITURAGE SPORTIF & CULTUREL", style = SgmType.Eyebrow.copy(color = SgmColor.Green, fontSize = 12.sp, letterSpacing = 0.20.em))
            Text(
                "REJOIGNEZ LA\nGREEN RÉVOLUTION\nDU SPORT",
                style = SgmType.Display2XL.copy(color = SgmColor.TextOnGreen, fontSize = 31.sp, lineHeight = 30.sp, letterSpacing = 0.02.em),
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun OnboardingWordmark() {
    Row(verticalAlignment = Alignment.Bottom) {
        Text("SPORTS ", style = SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.62f), fontSize = 17.sp))
        Text("GREEN-", style = SgmType.DisplayLG.copy(color = SgmColor.Green, fontSize = 17.sp))
        Text("m", style = SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen, fontSize = 21.sp))
        Text("OO", style = SgmType.Display2XL.copy(color = SgmColor.Green, fontSize = 32.sp))
        Text("Ve", style = SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen, fontSize = 21.sp))
    }
}

@Composable
private fun OnboardingModeTab(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    V2Chip(label, selected = selected, onClick = onClick, modifier = modifier.height(36.dp))
}

@Composable
private fun OnboardingInput(placeholder: String, value: String, onValue: (String) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Sgm.colors.bgInput)
            .border(BorderStroke(1.5.dp, Sgm.colors.border), RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 13.dp),
    ) {
        if (value.isEmpty()) Text(placeholder, style = SgmType.BodySM.copy(color = Sgm.colors.textMuted, fontSize = 14.sp, fontWeight = FontWeight.Medium))
        BasicTextField(value = value, onValueChange = onValue, textStyle = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium), singleLine = true, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun OnboardingDivider() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.weight(1f).height(1.dp).background(Sgm.colors.border))
        Text("OU CONTINUER AVEC", style = SgmType.BodyXS.copy(color = Sgm.colors.textMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold))
        Box(Modifier.weight(1f).height(1.dp).background(Sgm.colors.border))
    }
}

@Composable
private fun OnboardingSocialButton(label: String, onClick: () -> Unit, modifier: Modifier, testTag: String) {
    Box(
        modifier = modifier
            .sgmTestTag(testTag)
            .height(46.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, style = SgmType.BodySM.copy(color = Sgm.colors.textPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold))
    }
}
