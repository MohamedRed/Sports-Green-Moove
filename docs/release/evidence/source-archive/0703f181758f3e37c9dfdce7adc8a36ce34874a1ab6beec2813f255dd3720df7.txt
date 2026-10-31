package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import be.sportgreenmoove.app.data.VehicleMapPoint
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMapComposable
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberUpdatedMarkerState

@Composable
@GoogleMapComposable
internal fun VehicleMapMarker(point: VehicleMapPoint, stale: Boolean) {
    val state = rememberUpdatedMarkerState(LatLng(point.lat, point.lng))
    val icon = remember(stale) { BitmapDescriptorFactory.defaultMarker(
        if (stale) BitmapDescriptorFactory.HUE_ORANGE else BitmapDescriptorFactory.HUE_GREEN) }
    Marker(state = state, icon = icon, title = "Véhicule", zIndex = 2f,
        contentDescription = if (stale) "Dernière position du véhicule, à vérifier" else "Position du véhicule",
        snippet = if (stale) "Position à vérifier" else "Position reçue", tag = "active-ride.vehicle")
}
