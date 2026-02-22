import UIKit

// MARK: - Haptic Feedback Manager
class HapticManager {
    static let shared = HapticManager()
    private init() {}

    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let selectionGenerator = UISelectionFeedbackGenerator()
    private let notificationGenerator = UINotificationFeedbackGenerator()

    func impact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        guard AppConfig.hapticFeedbackEnabled else { return }

        switch style {
        case .light:
            impactLight.impactOccurred()
        case .medium:
            impactMedium.impactOccurred()
        case .heavy:
            impactHeavy.impactOccurred()
        default:
            impactMedium.impactOccurred()
        }
    }

    func selection() {
        guard AppConfig.hapticFeedbackEnabled else { return }
        selectionGenerator.selectionChanged()
    }

    func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        guard AppConfig.hapticFeedbackEnabled else { return }
        notificationGenerator.notificationOccurred(type)
    }

    // Prepare generators for immediate response
    func prepare() {
        impactLight.prepare()
        impactMedium.prepare()
        selectionGenerator.prepare()
        notificationGenerator.prepare()
    }
}
