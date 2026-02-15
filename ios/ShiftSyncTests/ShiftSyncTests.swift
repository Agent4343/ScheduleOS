import XCTest
@testable import ShiftSync

final class ShiftSyncTests: XCTestCase {

    // MARK: - App State Tests
    func testAppStateInitialValues() {
        let appState = AppState()
        XCTAssertFalse(appState.isAuthenticated)
        XCTAssertTrue(appState.isLoading)
        XCTAssertNil(appState.currentUser)
        XCTAssertEqual(appState.selectedTab, .dashboard)
    }

    func testAppStateLogout() {
        let appState = AppState()
        appState.isAuthenticated = true
        appState.currentUser = ShiftSyncUser(
            id: "test-id",
            email: "test@example.com",
            name: "Test User",
            role: .WORKER,
            crewId: nil,
            crewName: nil,
            organizationId: "org-1",
            organizationName: "Test Org"
        )

        appState.logout()

        XCTAssertFalse(appState.isAuthenticated)
        XCTAssertNil(appState.currentUser)
    }

    // MARK: - User Role Tests
    func testUserRoleDisplayName() {
        XCTAssertEqual(UserRole.ADMIN.displayName, "Administrator")
        XCTAssertEqual(UserRole.SUPERVISOR.displayName, "Supervisor")
        XCTAssertEqual(UserRole.WORKER.displayName, "Worker")
    }

    func testUserRoleIcon() {
        XCTAssertEqual(UserRole.ADMIN.icon, "shield.checkered")
        XCTAssertEqual(UserRole.SUPERVISOR.icon, "person.badge.key")
        XCTAssertEqual(UserRole.WORKER.icon, "person.fill")
    }

    // MARK: - Tab Item Tests
    func testTabItemWebPaths() {
        XCTAssertEqual(TabItem.dashboard.webPath, "/dashboard")
        XCTAssertEqual(TabItem.schedule.webPath, "/schedule")
        XCTAssertEqual(TabItem.crews.webPath, "/crews")
        XCTAssertEqual(TabItem.timeOff.webPath, "/time-off")
        XCTAssertEqual(TabItem.settings.webPath, "/settings")
    }

    func testTabItemTitles() {
        XCTAssertEqual(TabItem.dashboard.title, "Dashboard")
        XCTAssertEqual(TabItem.schedule.title, "Schedule")
        XCTAssertEqual(TabItem.crews.title, "Crews")
        XCTAssertEqual(TabItem.timeOff.title, "Time Off")
        XCTAssertEqual(TabItem.settings.title, "Settings")
    }

    // MARK: - Shift Type Tests
    func testShiftTypeDisplayNames() {
        XCTAssertEqual(ShiftType.DAY.displayName, "Day Shift")
        XCTAssertEqual(ShiftType.NIGHT.displayName, "Night Shift")
        XCTAssertEqual(ShiftType.OFF.displayName, "Off")
        XCTAssertEqual(ShiftType.VACATION.displayName, "Vacation")
        XCTAssertEqual(ShiftType.SICK.displayName, "Sick Leave")
        XCTAssertEqual(ShiftType.TRAINING.displayName, "Training")
        XCTAssertEqual(ShiftType.SHUTDOWN.displayName, "Shutdown")
    }

    func testShiftTypeIcons() {
        XCTAssertEqual(ShiftType.DAY.icon, "sun.max.fill")
        XCTAssertEqual(ShiftType.NIGHT.icon, "moon.stars.fill")
        XCTAssertEqual(ShiftType.OFF.icon, "house.fill")
    }

    // MARK: - Time Off Tests
    func testTimeOffTypeDisplayNames() {
        XCTAssertEqual(TimeOffType.VACATION.displayName, "Vacation")
        XCTAssertEqual(TimeOffType.SICK.displayName, "Sick Leave")
        XCTAssertEqual(TimeOffType.PERSONAL.displayName, "Personal")
        XCTAssertEqual(TimeOffType.BEREAVEMENT.displayName, "Bereavement")
        XCTAssertEqual(TimeOffType.JURY_DUTY.displayName, "Jury Duty")
    }

    // MARK: - App Config Tests
    func testAppConfigDefaults() {
        XCTAssertEqual(AppConfig.appVersion, "1.0.0")
        XCTAssertEqual(AppConfig.buildNumber, "1")
        XCTAssertTrue(AppConfig.biometricAuthEnabled)
        XCTAssertTrue(AppConfig.offlineModeEnabled)
        XCTAssertTrue(AppConfig.widgetEnabled)
        XCTAssertTrue(AppConfig.hapticFeedbackEnabled)
    }

    // MARK: - Keychain Tests
    func testKeychainStoreAndRetrieve() {
        let keychain = KeychainService.shared

        keychain.storeCredentials(email: "test@test.com", password: "password123")
        XCTAssertTrue(keychain.hasStoredCredentials())

        let creds = keychain.getCredentials()
        XCTAssertEqual(creds?.email, "test@test.com")
        XCTAssertEqual(creds?.password, "password123")

        keychain.deleteCredentials()
        XCTAssertFalse(keychain.hasStoredCredentials())
    }

    // MARK: - Color Extension Tests
    func testColorHexInit() {
        let color = Color(hex: "FF0000")
        XCTAssertNotNil(color)

        let color2 = Color(hex: "#2563EB")
        XCTAssertNotNil(color2)
    }

    // MARK: - Badge Counts Tests
    func testBadgeCountsDefaults() {
        let counts = BadgeCounts()
        XCTAssertEqual(counts.pendingTimeOff, 0)
        XCTAssertEqual(counts.notifications, 0)
        XCTAssertEqual(counts.staffingAlerts, 0)
    }

    // MARK: - Dashboard Stats Decoding
    func testDashboardStatsDecoding() throws {
        let json = """
        {
            "totalWorkers": 50,
            "activeCrews": 4,
            "onDutyToday": 25,
            "pendingRequests": 3,
            "staffingAlerts": 1,
            "upcomingShutdowns": 0
        }
        """.data(using: .utf8)!

        let stats = try JSONDecoder().decode(DashboardStats.self, from: json)
        XCTAssertEqual(stats.totalWorkers, 50)
        XCTAssertEqual(stats.activeCrews, 4)
        XCTAssertEqual(stats.onDutyToday, 25)
        XCTAssertEqual(stats.pendingRequests, 3)
        XCTAssertEqual(stats.staffingAlerts, 1)
        XCTAssertEqual(stats.upcomingShutdowns, 0)
    }
}
