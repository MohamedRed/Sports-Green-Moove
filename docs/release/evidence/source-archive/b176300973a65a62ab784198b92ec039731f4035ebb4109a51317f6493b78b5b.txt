import Foundation

#if canImport(UIKit)
import UIKit

extension UIApplication {
    var sgmTopViewController: UIViewController? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }?
            .rootViewController?
            .sgmTopMostPresented
    }
}

private extension UIViewController {
    var sgmTopMostPresented: UIViewController {
        if let presentedViewController {
            return presentedViewController.sgmTopMostPresented
        }
        if let navigationController = self as? UINavigationController,
           let visibleViewController = navigationController.visibleViewController {
            return visibleViewController.sgmTopMostPresented
        }
        if let tabBarController = self as? UITabBarController,
           let selectedViewController = tabBarController.selectedViewController {
            return selectedViewController.sgmTopMostPresented
        }
        return self
    }
}
#endif
