import SwiftUI

#if os(iOS) && canImport(GoogleMaps) && canImport(UIKit)
import CoreLocation
import GoogleMaps
import UIKit
#endif

struct GoogleMapsRoutePreviewCard: View {
    let ride: LiveRideSnapshot
    let preview: MapRoutePreview?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            content
            RoutePreviewOverlay(ride: ride)
        }
        .frame(height: 250)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: SGMRadius.xl, style: .continuous))
        .background(SGM.bgCard, in: RoundedRectangle(cornerRadius: SGMRadius.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SGMRadius.xl, style: .continuous).stroke(SGM.border, lineWidth: 1))
    }

    @ViewBuilder
    private var content: some View {
        if !NativeGoogleMapsLifecycle.isSdkLinked {
            RoutePreviewState(
                title: "GOOGLE MAPS REQUIS",
                message: "Le package GoogleMaps doit être lié au projet iOS."
            )
        } else if !NativeGoogleMapsLifecycle.isConfigured {
            RoutePreviewState(
                title: "CLÉ GOOGLE MAPS REQUISE",
                message: "Ajoutez SGM_GOOGLE_MAPS_IOS_API_KEY pour afficher l'itinéraire natif."
            )
        } else if let preview {
            #if os(iOS) && canImport(GoogleMaps) && canImport(UIKit)
            NativeGoogleMapsRoutePreview(preview: preview)
            #else
            RoutePreviewState(
                title: "GOOGLE MAPS REQUIS",
                message: "Le SDK Google Maps iOS n'est pas disponible dans cette cible."
            )
            #endif
        } else {
            RoutePreviewState(
                title: "ITINÉRAIRE MANQUANT",
                message: "Le trajet actif ne contient pas encore de coordonnées départ-arrivée."
            )
        }
    }
}

private struct RoutePreviewState: View {
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.sgmDisplay(24))
                .tracking(.sgmWide(for: 24))
                .foregroundStyle(SGM.textOnGreen)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.sgmBody(13, weight: .semibold))
                .foregroundStyle(SGM.textOnGreen.opacity(0.68))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SGM.heroGradient)
        .overlay(SGMGridTexture())
    }
}

private struct RoutePreviewOverlay: View {
    let ride: LiveRideSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("SUIVI EN DIRECT")
                .font(.sgmBody(11, weight: .bold))
                .tracking(.sgmWider(for: 11))
                .foregroundStyle(SGM.greenLight)
            Text(ride.etaLabel)
                .font(.sgmBody(13, weight: .bold))
                .foregroundStyle(SGM.textOnGreen)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(SGM.heroStart.opacity(0.86), in: RoundedRectangle(cornerRadius: SGMRadius.lg, style: .continuous))
        .padding(14)
    }
}

#if os(iOS) && canImport(GoogleMaps) && canImport(UIKit)
private struct NativeGoogleMapsRoutePreview: UIViewRepresentable {
    let preview: MapRoutePreview

    func makeUIView(context: Context) -> GMSMapView {
        let center = preview.center
        let camera = GMSCameraPosition.camera(
            withLatitude: center.lat,
            longitude: center.lng,
            zoom: preview.routeZoom
        )
        let mapView = GMSMapView.map(withFrame: .zero, camera: camera)
        mapView.settings.compassButton = false
        mapView.settings.indoorPicker = false
        mapView.settings.myLocationButton = false
        mapView.settings.rotateGestures = false
        mapView.settings.tiltGestures = false
        mapView.settings.zoomGestures = true
        mapView.isTrafficEnabled = true
        return mapView
    }

    func updateUIView(_ mapView: GMSMapView, context: Context) {
        mapView.clear()
        let path = GMSMutablePath()
        MapRoutePolyline.points(for: preview).forEach { point in
            path.addLatitude(point.lat, longitude: point.lng)
        }

        let polyline = GMSPolyline(path: path)
        polyline.strokeWidth = 5
        polyline.strokeColor = UIColor(SGM.green)
        polyline.map = mapView

        let start = GMSMarker(position: CLLocationCoordinate2D(latitude: preview.start.lat, longitude: preview.start.lng))
        start.title = "Départ"
        start.map = mapView

        let end = GMSMarker(position: CLLocationCoordinate2D(latitude: preview.end.lat, longitude: preview.end.lng))
        end.title = "Arrivée"
        end.map = mapView

        let center = preview.center
        mapView.animate(to: GMSCameraPosition.camera(
            withLatitude: center.lat,
            longitude: center.lng,
            zoom: preview.routeZoom
        ))
    }
}

private extension MapRoutePreview {
    var center: MapPoint {
        MapPoint(lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2)
    }

    var routeZoom: Float {
        let delta = max(abs(start.lat - end.lat), abs(start.lng - end.lng))
        switch delta {
        case ..<0.015: return 14
        case ..<0.06: return 12
        case ..<0.18: return 10
        default: return 8
        }
    }
}
#endif
