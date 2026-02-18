import SwiftUI
import Combine
import WebKit

// MARK: - App State
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var currentUser: ShiftSyncUser?
    @Published var selectedTab: TabItem = .dashboard
    @Published var hasCompletedOnboarding: Bool {
        didSet {
            UserDefaults.standard.set(hasCompletedOnboarding, forKey: "hasCompletedOnboarding")
        }
    }
    @Published var badgeCounts: BadgeCounts = BadgeCounts()

    // Server configuration
    @Published var serverURL: String {
        didSet {
            UserDefaults.standard.set(serverURL, forKey: "serverURL")
        }
    }

    init() {
        self.hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
        self.serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? AppConfig.defaultServerURL
    }

    func logout() {
        isAuthenticated = false
        currentUser = nil
        KeychainService.shared.deleteToken()
        // Clear cookies from both URLSession and WKWebView
        if let host = URL(string: serverURL)?.host {
            HTTPCookieStorage.shared.cookies?
                .filter { $0.domain.contains(host) || host.contains($0.domain) }
                .forEach { HTTPCookieStorage.shared.deleteCookie($0) }
        }
        WKWebsiteDataStore.default().removeData(
            ofTypes: [WKWebsiteDataTypeCookies],
            modifiedSince: .distantPast
        ) {}
        HapticManager.shared.notification(type: .success)
    }
}

// MARK: - Data Models
struct ShiftSyncUser: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    let role: UserRole
    let crewId: String?
    let crewName: String?
    let organizationId: String
    let organizationName: String?
}

enum UserRole: String, Codable {
    case ADMIN
    case SUPERVISOR
    case WORKER

    var displayName: String {
        switch self {
        case .ADMIN: return "Administrator"
        case .SUPERVISOR: return "Supervisor"
        case .WORKER: return "Worker"
        }
    }

    var icon: String {
        switch self {
        case .ADMIN: return "shield.checkered"
        case .SUPERVISOR: return "person.badge.key"
        case .WORKER: return "person.fill"
        }
    }
}

struct BadgeCounts {
    var pendingTimeOff: Int = 0
    var notifications: Int = 0
    var staffingAlerts: Int = 0
}

// MARK: - Tab Items
enum TabItem: String, CaseIterable {
    case dashboard
    case schedule
    case attendance
    case timeOff
    case settings

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .schedule: return "Schedule"
        case .attendance: return "Attendance"
        case .timeOff: return "Time Off"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "chart.bar.fill"
        case .schedule: return "calendar"
        case .attendance: return "checklist.checked"
        case .timeOff: return "airplane.departure"
        case .settings: return "gearshape.fill"
        }
    }

    var webPath: String {
        switch self {
        case .dashboard: return "/dashboard"
        case .schedule: return "/schedule"
        case .attendance: return "/attendance"
        case .timeOff: return "/time-off"
        case .settings: return "/settings"
        }
    }
}

// MARK: - Shift Types
enum ShiftType: String, Codable, CaseIterable {
    case DAY
    case NIGHT
    case OFF
    case VACATION
    case SICK
    case TRAINING
    case SHUTDOWN

    var displayName: String {
        switch self {
        case .DAY: return "Day Shift"
        case .NIGHT: return "Night Shift"
        case .OFF: return "Off"
        case .VACATION: return "Vacation"
        case .SICK: return "Sick Leave"
        case .TRAINING: return "Training"
        case .SHUTDOWN: return "Shutdown"
        }
    }

    var color: Color {
        switch self {
        case .DAY: return Color("ShiftDay", bundle: nil)
        case .NIGHT: return Color("ShiftNight", bundle: nil)
        case .OFF: return .gray.opacity(0.3)
        case .VACATION: return .blue.opacity(0.6)
        case .SICK: return .red.opacity(0.5)
        case .TRAINING: return .purple.opacity(0.6)
        case .SHUTDOWN: return .orange.opacity(0.6)
        }
    }

    var icon: String {
        switch self {
        case .DAY: return "sun.max.fill"
        case .NIGHT: return "moon.stars.fill"
        case .OFF: return "house.fill"
        case .VACATION: return "airplane"
        case .SICK: return "cross.case.fill"
        case .TRAINING: return "book.fill"
        case .SHUTDOWN: return "wrench.and.screwdriver.fill"
        }
    }
}

// MARK: - Schedule Entry
struct ScheduleEntry: Codable, Identifiable {
    let id: String
    let date: String
    let shiftType: ShiftType
    let userId: String
    let userName: String?
    let crewId: String?
    let crewName: String?
    let isOverride: Bool
    let overrideReason: String?
}

// MARK: - Time Off Request
struct TimeOffRequest: Codable, Identifiable {
    let id: String
    let userId: String
    let userName: String?
    let type: TimeOffType
    let startDate: String
    let endDate: String
    let status: TimeOffStatus
    let reason: String?
    let createdAt: String
}

enum TimeOffType: String, Codable {
    case VACATION, SICK, PERSONAL, BEREAVEMENT, JURY_DUTY

    var displayName: String {
        switch self {
        case .VACATION: return "Vacation"
        case .SICK: return "Sick Leave"
        case .PERSONAL: return "Personal"
        case .BEREAVEMENT: return "Bereavement"
        case .JURY_DUTY: return "Jury Duty"
        }
    }
}

enum TimeOffStatus: String, Codable {
    case PENDING, APPROVED, DENIED, CANCELLED

    var color: Color {
        switch self {
        case .PENDING: return .orange
        case .APPROVED: return .green
        case .DENIED: return .red
        case .CANCELLED: return .gray
        }
    }
}

// MARK: - Dashboard Stats
struct DashboardStats: Codable {
    let totalWorkers: Int
    let activeCrews: Int
    let onDutyToday: Int
    let pendingRequests: Int
    let staffingAlerts: Int
    let upcomingShutdowns: Int
}

// MARK: - App Configuration
struct AppConfig {
    // Change this to your deployed ShiftSync URL
    static let defaultServerURL = "https://scheduleos-production.up.railway.app"
    static let appVersion = "1.0.0"
    static let buildNumber = "1"
    static let appStoreID = "" // Fill in after App Store submission
    static let supportEmail = "support@shiftsync.app"
    static let privacyPolicyURL = "https://scheduleos-production.up.railway.app/privacy"
    static let termsOfServiceURL = "https://scheduleos-production.up.railway.app/terms"

    // Feature flags
    static let biometricAuthEnabled = true
    static let offlineModeEnabled = true
    static let widgetEnabled = true
    static let hapticFeedbackEnabled = true
}
