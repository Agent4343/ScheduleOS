import SwiftUI

// MARK: - Theme Manager
class ThemeManager: ObservableObject {
    @Published var selectedTheme: Theme {
        didSet {
            UserDefaults.standard.set(selectedTheme.rawValue, forKey: "selectedTheme")
        }
    }

    enum Theme: String, CaseIterable {
        case system
        case light
        case dark

        var icon: String {
            switch self {
            case .system: return "circle.lefthalf.filled"
            case .light: return "sun.max.fill"
            case .dark: return "moon.fill"
            }
        }
    }

    var colorScheme: ColorScheme? {
        switch selectedTheme {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    init() {
        let saved = UserDefaults.standard.string(forKey: "selectedTheme") ?? "system"
        self.selectedTheme = Theme(rawValue: saved) ?? .system
    }

    // MARK: - Brand Colors
    struct Colors {
        static let brandPrimary = Color(hex: "2563EB")      // Blue-600
        static let brandSecondary = Color(hex: "7C3AED")    // Violet-600
        static let brandAccent = Color(hex: "06B6D4")       // Cyan-500

        // Shift type colors (matching web app)
        static let shiftDay = Color(hex: "F59E0B")          // Amber-500
        static let shiftNight = Color(hex: "6366F1")        // Indigo-500
        static let shiftOff = Color(hex: "9CA3AF")          // Gray-400
        static let shiftVacation = Color(hex: "3B82F6")     // Blue-500
        static let shiftSick = Color(hex: "EF4444")         // Red-500
        static let shiftTraining = Color(hex: "8B5CF6")     // Violet-500
        static let shiftShutdown = Color(hex: "F97316")     // Orange-500

        // Semantic colors
        static let success = Color(hex: "10B981")           // Emerald-500
        static let warning = Color(hex: "F59E0B")           // Amber-500
        static let error = Color(hex: "EF4444")             // Red-500
        static let info = Color(hex: "3B82F6")              // Blue-500

        // Background gradients
        static let primaryGradient = LinearGradient(
            colors: [brandPrimary, brandSecondary],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        static let cardGradient = LinearGradient(
            colors: [
                Color(.systemBackground),
                Color(.secondarySystemBackground)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}
