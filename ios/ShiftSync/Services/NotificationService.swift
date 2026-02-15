import Foundation
import UserNotifications

// MARK: - Notification Service
class NotificationService {
    static let shared = NotificationService()
    private init() {}

    private var deviceToken: String?

    // MARK: - Device Token
    func registerDeviceToken(_ token: String) {
        self.deviceToken = token
        // Send to server for push notification targeting
        sendTokenToServer(token)
    }

    private func sendTokenToServer(_ token: String) {
        guard let serverURL = UserDefaults.standard.string(forKey: "serverURL"),
              let url = URL(string: "\(serverURL)/api/notifications/register-device") else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "deviceToken": token,
            "platform": "ios",
            "appVersion": AppConfig.appVersion
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request).resume()
    }

    // MARK: - Handle Notification Tap
    func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        guard let type = userInfo["type"] as? String else { return }

        switch type {
        case "time_off_request":
            NotificationCenter.default.post(
                name: .navigateToTab,
                object: nil,
                userInfo: ["tab": TabItem.timeOff]
            )
        case "schedule_change":
            NotificationCenter.default.post(
                name: .navigateToTab,
                object: nil,
                userInfo: ["tab": TabItem.schedule]
            )
        case "staffing_alert":
            NotificationCenter.default.post(
                name: .navigateToTab,
                object: nil,
                userInfo: ["tab": TabItem.dashboard]
            )
        default:
            break
        }
    }

    // MARK: - Local Notifications
    func scheduleShiftReminder(
        title: String,
        body: String,
        date: Date,
        identifier: String
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = "SHIFT_REMINDER"

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    func cancelNotification(identifier: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [identifier]
        )
    }

    func cancelAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    // MARK: - Notification Categories
    func registerNotificationCategories() {
        // Time-off approval actions
        let approveAction = UNNotificationAction(
            identifier: "APPROVE_TIME_OFF",
            title: "Approve",
            options: [.authenticationRequired]
        )
        let denyAction = UNNotificationAction(
            identifier: "DENY_TIME_OFF",
            title: "Deny",
            options: [.authenticationRequired, .destructive]
        )
        let timeOffCategory = UNNotificationCategory(
            identifier: "TIME_OFF_REQUEST",
            actions: [approveAction, denyAction],
            intentIdentifiers: [],
            options: []
        )

        // Shift reminder actions
        let acknowledgeAction = UNNotificationAction(
            identifier: "ACKNOWLEDGE_SHIFT",
            title: "Got it",
            options: []
        )
        let shiftCategory = UNNotificationCategory(
            identifier: "SHIFT_REMINDER",
            actions: [acknowledgeAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([
            timeOffCategory,
            shiftCategory
        ])
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let navigateToTab = Notification.Name("navigateToTab")
}
