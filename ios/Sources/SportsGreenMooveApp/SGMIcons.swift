import SwiftUI

enum SGMIcon {
    case home
    case calendar
    case chat
    case profile
    case plus
    case moon
    case sun
    case search
    case chevronLeft
    case chevronRight
    case location
    case groups
    case award
    case bell
    case settings
    case arrowRight
    case check
    case leaf
    case star

    var systemName: String {
        switch self {
        case .home: "house"
        case .calendar: "calendar"
        case .chat: "message"
        case .profile: "person"
        case .plus: "plus"
        case .moon: "moon"
        case .sun: "sun.max"
        case .search: "magnifyingglass"
        case .chevronLeft: "chevron.left"
        case .chevronRight: "chevron.right"
        case .location: "mappin.and.ellipse"
        case .groups: "person.2"
        case .award: "medal"
        case .bell: "bell"
        case .settings: "gearshape"
        case .arrowRight: "arrow.right"
        case .check: "checkmark"
        case .leaf: "leaf"
        case .star: "star.fill"
        }
    }
}

struct SGMIconView: View {
    let icon: SGMIcon
    var size: CGFloat = 16
    var color = SGM.textSecondary

    var body: some View {
        Image(systemName: icon.systemName)
            .font(.system(size: size, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: size + 2, height: size + 2)
    }
}

extension AppTab {
    var icon: SGMIcon {
        switch self {
        case .home: .home
        case .trips: .calendar
        case .publish: .plus
        case .messages: .chat
        case .profile: .profile
        }
    }
}
