package be.sportgreenmoove.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.unit.IntSize
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.MapEffect
import com.google.maps.android.compose.MapsComposeExperimentalApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext

@OptIn(MapsComposeExperimentalApi::class)
@Composable
internal fun FitRouteMapCamera(
    camera: CameraPositionState, points: List<LatLng>, anchors: List<LatLng>, viewport: IntSize,
    paddingPixels: Int, onLoaded: (Boolean) -> Unit,
) {
    val reportLoaded by rememberUpdatedState(onLoaded)
    MapEffect(camera, points, anchors, viewport, paddingPixels) { map ->
        if (viewport.width <= paddingPixels * 2 || viewport.height <= paddingPixels * 2) return@MapEffect
        reportLoaded(false)
        val bounds = LatLngBounds.builder().apply { (points + anchors).forEach(::include) }.build()
        camera.move(CameraUpdateFactory.newLatLngBounds(bounds, viewport.width, viewport.height, paddingPixels))
        // Register after fitting: the SDK's load acknowledgement is one-shot.
        map.setOnMapLoadedCallback {
            val projected = anchors.map { map.projection.toScreenLocation(it).let { point -> point.x to point.y } }
            reportLoaded(routeMapAnchorsFit(projected, viewport.width, viewport.height, paddingPixels))
        }
        try { awaitCancellation() } finally {
            withContext(NonCancellable + Dispatchers.Main.immediate) {
                map.setOnMapLoadedCallback(null)
            }
        }
    }
}
