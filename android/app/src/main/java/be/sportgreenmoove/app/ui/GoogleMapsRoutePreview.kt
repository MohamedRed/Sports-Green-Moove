package be.sportgreenmoove.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import be.sportgreenmoove.app.R
import be.sportgreenmoove.app.data.LiveRideSnapshot
import be.sportgreenmoove.app.data.MapRoutePreview
import be.sportgreenmoove.app.design.Sgm
import be.sportgreenmoove.app.design.SgmColor
import be.sportgreenmoove.app.design.SgmType
import be.sportgreenmoove.app.domain.MapRoutePolyline
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.Polyline
import com.google.maps.android.compose.rememberCameraPositionState

@Composable
fun GoogleMapsRoutePreviewCard(
    ride: LiveRideSnapshot,
    preview: MapRoutePreview?,
) {
    val apiKey = stringResource(R.string.sgm_google_maps_android_api_key).trim()
    Box(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .height(250.dp)
            .sgmTestTag(SgmTestTags.GoogleMapsRoutePreview)
            .clip(RoundedCornerShape(22.dp))
            .background(Sgm.colors.bgCard)
            .border(BorderStroke(1.dp, Sgm.colors.border), RoundedCornerShape(22.dp)),
    ) {
        when {
            apiKey.isBlank() -> RoutePreviewState(
                title = "GOOGLE MAPS REQUIS",
                body = "Ajoutez SGM_GOOGLE_MAPS_ANDROID_API_KEY pour afficher l'itinéraire natif.",
            )

            preview == null -> RoutePreviewState(
                title = "ITINÉRAIRE MANQUANT",
                body = "Le trajet actif ne contient pas encore de coordonnées départ-arrivée.",
            )

            else -> NativeGoogleMap(preview = preview)
        }
        RoutePreviewOverlay(ride)
    }
}

@Composable
private fun NativeGoogleMap(preview: MapRoutePreview) {
    val points = remember(preview) {
        MapRoutePolyline.pointsFor(preview).map { LatLng(it.lat, it.lng) }
    }
    val start = LatLng(preview.start.lat, preview.start.lng)
    val end = LatLng(preview.end.lat, preview.end.lng)
    val center = LatLng(
        (preview.start.lat + preview.end.lat) / 2.0,
        (preview.start.lng + preview.end.lng) / 2.0,
    )
    val cameraState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(center, routeZoom(preview))
    }

    GoogleMap(
        modifier = Modifier.fillMaxWidth().height(250.dp),
        cameraPositionState = cameraState,
        properties = MapProperties(isTrafficEnabled = true),
        uiSettings = MapUiSettings(
            compassEnabled = false,
            indoorLevelPickerEnabled = false,
            mapToolbarEnabled = false,
            myLocationButtonEnabled = false,
            rotationGesturesEnabled = false,
            tiltGesturesEnabled = false,
            zoomControlsEnabled = false,
        ),
    ) {
        Polyline(points = points, color = SgmColor.Green, width = 10f)
        Marker(state = MarkerState(position = start), title = "Départ")
        Marker(state = MarkerState(position = end), title = "Arrivée")
    }
}

@Composable
private fun RoutePreviewState(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SgmColor.HeroGradient)
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            title,
            style = SgmType.DisplayXL.copy(color = SgmColor.TextOnGreen, fontSize = 24.sp, letterSpacing = 0.06.em),
            textAlign = TextAlign.Center,
        )
        Text(
            body,
            style = SgmType.BodySM.copy(color = SgmColor.TextOnGreen.copy(alpha = 0.68f), fontSize = 13.sp),
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun BoxScope.RoutePreviewOverlay(ride: LiveRideSnapshot) {
    Column(
        modifier = Modifier
            .align(Alignment.BottomStart)
            .padding(14.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(SgmColor.HeroStart.copy(alpha = 0.86f))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            "SUIVI EN DIRECT",
            style = SgmType.Eyebrow.copy(color = SgmColor.GreenLight, fontSize = 11.sp, letterSpacing = 0.14.em),
        )
        Text(
            ride.etaLabel,
            style = SgmType.BodySM.copy(color = SgmColor.TextOnGreen, fontSize = 13.sp, fontWeight = FontWeight.Bold),
        )
    }
}

private fun routeZoom(preview: MapRoutePreview): Float {
    val latDelta = kotlin.math.abs(preview.start.lat - preview.end.lat)
    val lngDelta = kotlin.math.abs(preview.start.lng - preview.end.lng)
    val delta = maxOf(latDelta, lngDelta)
    return when {
        delta < 0.015 -> 14f
        delta < 0.06 -> 12f
        delta < 0.18 -> 10f
        else -> 8f
    }
}
