package be.sportgreenmoove.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import be.sportgreenmoove.app.data.*
import be.sportgreenmoove.app.services.*
import kotlinx.coroutines.launch

@Composable
internal fun EmergencyContactRoute(uid: String, roles: Set<AppRole>, gateway: EmergencyContactGateway,
    guardians: GuardianVerificationGateway, onBack: () -> Unit,
    launchDialer: ((PersonalEmergencyContact) -> EmergencyDialerResult)? = null, rideSessionId: String? = null,
    accountLinks: ChildAccountLinkGateway = UnconfiguredChildAccountLinkGateway()) {
    var linkAccount by remember(uid, roles, gateway) { mutableStateOf(false) }
    var linkTarget by remember(uid, roles, gateway) { mutableStateOf<ChildAccountLinkTarget?>(null) }
    if (linkAccount) ChildAccountLinkDialog(uid, accountLinks, linkTarget) { linkAccount = false; linkTarget = null }
    if (AppRole.Child in roles) {
        if (rideSessionId == null) V2Screen {
            V2TopBar("CONTACT D’URGENCE", onBack, titleLines = 2)
            Column(Modifier.padding(20.dp)) {
                Text("Contact indisponible hors trajet.")
                EmergencyContactButton("Lier mon compte", "emergency.child-link", true, { linkAccount = true })
            }
        }
        else ChildRideEmergencyRoute(uid, rideSessionId, gateway, onBack, launchDialer)
        return
    }
    val canManage = AppRole.Child !in roles && roles.any { it in setOf(AppRole.Parent, AppRole.Driver, AppRole.ClubManager) }
    if (!canManage) {
        V2Screen { V2TopBar("CONTACT D’URGENCE", onBack, titleLines = 2); Text("Accès indisponible.") }; return
    }
    var savedScope by rememberSaveable(uid) { mutableStateOf(arrayListOf<String>()) }
    val state = remember(uid, gateway) {
        val target = if (savedScope.isEmpty()) EmergencyContactTarget.Self else {
            check(savedScope.size == 2); EmergencyContactTarget.Child(savedScope[0], savedScope[1])
        }
        EmergencyContactState(uid, gateway, target)
    }
    val children = remember(uid, guardians) { GuardianPageState({ cursor -> guardians.guardianHistory(uid, cursor).also { page ->
        check(page.items.all { it.parentUserId == uid && it.status != null })
    } }, GuardianVerification::id) }
    val scope = rememberCoroutineScope(); val owner = LocalLifecycleOwner.current; val context = LocalContext.current
    val parent = AppRole.Parent in roles
    var picker by remember(state) { mutableStateOf(false) }
    var discard by remember(state) { mutableStateOf<(() -> Unit)?>(null) }
    var removal by remember(state) { mutableStateOf<EmergencyContactView?>(null) }
    fun navigation(action: () -> Unit) { if (state.dirty) discard = action else action() }
    fun select(target: EmergencyContactTarget) {
        navigation {
            if (state.select(target)) {
                savedScope = if (target is EmergencyContactTarget.Child) arrayListOf(target.childId, target.clubId) else arrayListOf()
                picker = false; scope.launch { state.refresh() }
            }
        }
    }
    DisposableEffect(state, children) { onDispose { state.close(); children.close() } }
    LaunchedEffect(state, children, owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            try { if (parent) children.reload(); state.refresh(); kotlinx.coroutines.awaitCancellation() }
            finally { state.leaveForeground() }
        }
    }
    LaunchedEffect(state.view) { removal = null }
    BackHandler { navigation(onBack) }
    EmergencyContactScreen(state, parent, { navigation(onBack) },
        onRefresh = { navigation { scope.launch { if (parent) children.reload(); state.refresh() } } },
        onSelf = { select(EmergencyContactTarget.Self) }, onChildren = { picker = true },
        onSave = { scope.launch { state.save() } }, onRemove = { removal = it }, onDial = {
            scope.launch { state.dial { contact ->
                if (!owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) EmergencyDialerResult.Cancelled
                else if (launchDialer != null) launchDialer(contact) else openEmergencyDialer(context, contact)
            } }
        }, onLinkAccount = { view ->
            val target = view.target as? EmergencyContactTarget.Child
            if (target != null && view.childInstanceId != null) {
                linkTarget = ChildAccountLinkTarget(target.childId, target.clubId, view.childInstanceId, requireNotNull(view.childName))
                linkAccount = true
            }
        })
    if (picker) EmergencyChildDialog(children, selectionBusy = state.busy,
        onChoose = { item -> select(EmergencyContactTarget.Child(item.childId, item.clubId)) },
        onMore = { scope.launch { children.more() } }, onRetry = { scope.launch { children.reload() } }, onClose = { picker = false })
    discard?.let { action -> EmergencyConfirmation("Quitter sans enregistrer ?", "Les modifications non enregistrées seront effacées.",
        "Continuer", { discard = null }, { discard = null; action() }) }
    removal?.let { view -> EmergencyConfirmation("Supprimer le contact ?", "Le contact enregistré sera supprimé.",
        "Supprimer", { removal = null }, { removal = null; scope.launch { state.remove(view) } }) }
}
