import SwiftUI

struct PublishScreen: View {
    @Environment(AppState.self) private var appState
    @State private var controller = PublishController()
    @State private var step = 1
    @State private var from = ""
    @State private var to = ""
    @State private var category = "U 7/8"
    @State private var returnTrip = true
    @State private var childTracking = true
    @State private var seats = 2
    @State private var frequency = "UNIQUE"
    @State private var price = ""
    @State private var departureIso = ISO8601DateFormatter().string(from: Date().addingTimeInterval(TimeInterval(30 * 86_400)))

    var body: some View {
        SGMScreen(spacing: 10, testID: UITestIdentifier.publishScreen) {
            SGMTopBar(title: "PUBLIER UN TRAJET")
            PublishStepper(step: step)
            VStack(spacing: 12) {
                if appState.selectedRole != .driver {
                    PublishDriverRequiredCard()
                } else {
                    currentStep
                }
            }
            .padding(.horizontal, SGMSpace.padScreen)
        }
    }

    @ViewBuilder
    private var currentStep: some View {
        switch step {
        case 1:
            PublishPlaceStep(
                controller: controller,
                from: $from,
                to: $to,
                onSearchOrigin: { Task { await controller.suggestPlaces(input: from, target: .origin, firebase: appState.firebase, onError: setError) } },
                onSearchDestination: { Task { await controller.suggestPlaces(input: to, target: .destination, firebase: appState.firebase, onError: setError) } },
                onSelectOrigin: { suggestion in Task { await controller.select(suggestion, target: .origin, firebase: appState.firebase, onError: setError) } },
                onSelectDestination: { suggestion in Task { await controller.select(suggestion, target: .destination, firebase: appState.firebase, onError: setError) } },
                onNext: nextFromPlaces
            )
        case 2:
            PublishDetailsStep(
                category: $category,
                departureIso: $departureIso,
                returnTrip: $returnTrip,
                childTracking: $childTracking,
                seats: $seats,
                frequency: $frequency,
                price: $price,
                onNext: { step = 3 }
            )
        default:
            PublishConfirmStep(
                from: controller.origin?.formattedAddress ?? from,
                to: controller.destination?.formattedAddress ?? to,
                category: category,
                seats: seats,
                frequency: frequency,
                returnTrip: returnTrip,
                price: price,
                loading: controller.loading,
                onPublish: publish
            )
        }
    }

    private func nextFromPlaces() {
        guard controller.origin != nil, controller.destination != nil else {
            appState.errorMessage = "Choisissez un départ et une destination dans les suggestions."
            return
        }
        step = 2
    }

    private func publish() {
        Task {
            await controller.publish(
                draft: makeDraft(),
                firebase: appState.firebase,
                onNotice: { appState.noticeMessage = $0 },
                onError: setError,
                onPublished: { await appState.refreshAppData() }
            )
        }
    }

    private func makeDraft() -> TripPublishDraft? {
        guard let origin = controller.origin, let destination = controller.destination else { return nil }
        return TripPublishDraft(
            title: "U8 Nationaux vs Royal Ottignies SC",
            sport: "Football",
            clubName: "Royal Ottignies",
            teamName: category,
            clubId: "royal-ottignies",
            teamId: category.lowercased().replacingOccurrences(of: " ", with: "-"),
            category: category,
            departureAtIso: departureIso,
            origin: origin,
            destination: destination,
            pickupRadiusM: 1_500,
            seatsTotal: seats,
            seatsAvailable: seats,
            baggage: "medium",
            returnTrip: returnTrip,
            priceCents: parsePriceCents(price),
            supportsVehicleTracking: true,
            supportsChildTracking: childTracking,
            co2SavedKgEstimate: 4.2
        )
    }

    private func setError(_ message: String?) {
        appState.errorMessage = message
    }
}

private func parsePriceCents(_ value: String) -> Int {
    let normalized = value.replacingOccurrences(of: ",", with: ".")
        .trimmingCharacters(in: .whitespacesAndNewlines)
    let amount = Double(normalized) ?? 0
    return max(0, Int(amount * 100))
}
