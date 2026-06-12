import SwiftUI

struct SearchChildSelector: View {
    let children: [ChildSummary]
    @Binding var selectedChildId: String?

    var body: some View {
        if !children.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("ENFANT")
                    .font(.sgmBody(11, weight: .bold))
                    .tracking(.sgmWider(for: 11))
                    .foregroundStyle(SGM.textMuted)
                ForEach(options.chunked(into: 2), id: \.self) { row in
                    HStack(spacing: 6) {
                        ForEach(row, id: \.self) { option in
                            SGMChip(text: option.label, selected: option.childId == selectedChildId) {
                                selectedChildId = option.childId
                            }
                        }
                        if row.count == 1 {
                            Spacer()
                        }
                    }
                }
                Text(selectedChildLabel)
                    .font(.sgmBody(12, weight: .bold))
                    .foregroundStyle(SGM.green)
            }
        }
    }

    private var options: [ChildOption] {
        children.map(ChildOption.child) + [.none]
    }

    private var selectedChildLabel: String {
        children.first { $0.id == selectedChildId }?.teamLabel ?? "Aucun enfant attaché à la demande"
    }
}

private enum ChildOption: Hashable {
    case child(ChildSummary)
    case none

    var childId: String? {
        switch self {
        case .child(let child): child.id
        case .none: nil
        }
    }

    var label: String {
        switch self {
        case .child(let child): child.label
        case .none: "Aucun"
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
