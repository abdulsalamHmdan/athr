import SwiftUI
import UIKit

@main
struct AtharQuestApp: App {
    @StateObject private var model = AppModel()

    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(AtharTheme.surface)
        appearance.shadowColor = UIColor(AtharTheme.divider)
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(AtharTheme.secondaryText)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(AtharTheme.secondaryText)
        ]
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(AtharTheme.forest)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(AtharTheme.forest)
        ]
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance

        let navigationAppearance = UINavigationBarAppearance()
        navigationAppearance.configureWithOpaqueBackground()
        navigationAppearance.backgroundColor = UIColor(AtharTheme.pageBackground)
        navigationAppearance.shadowColor = .clear
        UINavigationBar.appearance().standardAppearance = navigationAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navigationAppearance
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environment(\.layoutDirection, .rightToLeft)
                .tint(AtharTheme.forest)
        }
    }
}
