import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @State private var previousTab: TabItem = .dashboard

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            DashboardTabView()
                .tabItem {
                    Label(TabItem.dashboard.title, systemImage: TabItem.dashboard.icon)
                }
                .tag(TabItem.dashboard)

            ScheduleTabView()
                .tabItem {
                    Label(TabItem.schedule.title, systemImage: TabItem.schedule.icon)
                }
                .tag(TabItem.schedule)

            AttendanceTabView()
                .tabItem {
                    Label(TabItem.attendance.title, systemImage: TabItem.attendance.icon)
                }
                .tag(TabItem.attendance)

            CrewsTabView()
                .tabItem {
                    Label(TabItem.crews.title, systemImage: TabItem.crews.icon)
                }
                .tag(TabItem.crews)

            TimeOffTabView()
                .tabItem {
                    Label(TabItem.timeOff.title, systemImage: TabItem.timeOff.icon)
                }
                .badge(appState.badgeCounts.pendingTimeOff)
                .tag(TabItem.timeOff)

            SettingsTabView()
                .tabItem {
                    Label(TabItem.settings.title, systemImage: TabItem.settings.icon)
                }
                .tag(TabItem.settings)
        }
        .tint(ThemeManager.Colors.brandPrimary)
        .onChange(of: appState.selectedTab) { _, newTab in
            if newTab != previousTab {
                HapticManager.shared.selection()
                previousTab = newTab
            }
        }
    }
}

// MARK: - Dashboard Tab
struct DashboardTabView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            WebViewContainer(path: "/dashboard")
                .navigationTitle("Dashboard")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        NotificationBellButton()
                    }
                    ToolbarItem(placement: .navigationBarTrailing) {
                        UserAvatarButton()
                    }
                }
        }
    }
}

// MARK: - Schedule Tab
struct ScheduleTabView: View {
    var body: some View {
        NavigationStack {
            WebViewContainer(path: "/schedule")
                .navigationTitle("Schedule")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: {
                            HapticManager.shared.impact(style: .light)
                        }) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
        }
    }
}

// MARK: - Attendance Tab
struct AttendanceTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var showScanner = false

    var body: some View {
        NavigationStack {
            WebViewContainer(path: "/attendance")
                .navigationTitle("Attendance")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        NavigationLink {
                            WebViewContainer(path: "/attendance/qr")
                                .navigationTitle("My QR Code")
                                .navigationBarTitleDisplayMode(.inline)
                        } label: {
                            Image(systemName: "qrcode")
                                .foregroundColor(ThemeManager.Colors.brandPrimary)
                        }
                    }
                    if appState.currentUser?.role == .ADMIN || appState.currentUser?.role == .SUPERVISOR {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: { showScanner = true }) {
                                Image(systemName: "qrcode.viewfinder")
                                    .foregroundColor(ThemeManager.Colors.brandPrimary)
                            }
                        }
                    }
                }
                .sheet(isPresented: $showScanner) {
                    NavigationStack {
                        QRScannerView()
                            .navigationTitle("Scan Code")
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbar {
                                ToolbarItem(placement: .navigationBarLeading) {
                                    Button("Done") { showScanner = false }
                                }
                            }
                    }
                }
        }
    }
}

// MARK: - Crews Tab
struct CrewsTabView: View {
    var body: some View {
        NavigationStack {
            WebViewContainer(path: "/crews")
                .navigationTitle("Crews")
                .navigationBarTitleDisplayMode(.large)
        }
    }
}

// MARK: - Time Off Tab
struct TimeOffTabView: View {
    var body: some View {
        NavigationStack {
            WebViewContainer(path: "/time-off")
                .navigationTitle("Time Off")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button(action: {
                            HapticManager.shared.impact(style: .light)
                        }) {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(ThemeManager.Colors.brandPrimary)
                        }
                    }
                }
        }
    }
}

// MARK: - Settings Tab
struct SettingsTabView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var themeManager: ThemeManager

    var body: some View {
        NavigationStack {
            List {
                // Profile section
                Section {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [ThemeManager.Colors.brandPrimary, ThemeManager.Colors.brandSecondary],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 56, height: 56)

                            Text(appState.currentUser?.name.prefix(1).uppercased() ?? "U")
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(appState.currentUser?.name ?? "User")
                                .font(.system(size: 18, weight: .semibold))
                            Text(appState.currentUser?.email ?? "")
                                .font(.system(size: 14))
                                .foregroundColor(.secondary)
                            if let role = appState.currentUser?.role {
                                Label(role.displayName, systemImage: role.icon)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(ThemeManager.Colors.brandPrimary)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }

                // App settings
                Section("Appearance") {
                    Picker("Theme", selection: $themeManager.selectedTheme) {
                        ForEach(ThemeManager.Theme.allCases, id: \.self) { theme in
                            Label(theme.rawValue.capitalized, systemImage: theme.icon)
                                .tag(theme)
                        }
                    }
                }

                // Organization settings (web view)
                Section("Organization") {
                    NavigationLink {
                        WebViewContainer(path: "/settings")
                            .navigationTitle("Organization Settings")
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        Label("Organization Settings", systemImage: "building.2")
                    }

                    NavigationLink {
                        WebViewContainer(path: "/workers")
                            .navigationTitle("Workers")
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        Label("Manage Workers", systemImage: "person.3")
                    }

                    NavigationLink {
                        WebViewContainer(path: "/reports")
                            .navigationTitle("Reports")
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        Label("Reports & Analytics", systemImage: "chart.xyaxis.line")
                    }
                }

                // App info
                Section("About") {
                    HStack {
                        Label("Version", systemImage: "info.circle")
                        Spacer()
                        Text("\(AppConfig.appVersion) (\(AppConfig.buildNumber))")
                            .foregroundColor(.secondary)
                    }

                    Link(destination: URL(string: AppConfig.privacyPolicyURL)!) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }

                    Link(destination: URL(string: AppConfig.termsOfServiceURL)!) {
                        Label("Terms of Service", systemImage: "doc.text")
                    }

                    Button(action: {
                        if let url = URL(string: "mailto:\(AppConfig.supportEmail)") {
                            UIApplication.shared.open(url)
                        }
                    }) {
                        Label("Contact Support", systemImage: "envelope")
                    }
                }

                // Server configuration
                Section("Advanced") {
                    HStack {
                        Label("Server", systemImage: "server.rack")
                        Spacer()
                        Text(appState.serverURL)
                            .foregroundColor(.secondary)
                            .font(.system(size: 13))
                            .lineLimit(1)
                    }
                }

                // Logout
                Section {
                    Button(action: {
                        HapticManager.shared.notification(type: .warning)
                        appState.logout()
                    }) {
                        HStack {
                            Spacer()
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.red)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

// MARK: - Toolbar Components
struct NotificationBellButton: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Button(action: {
            HapticManager.shared.impact(style: .light)
        }) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell.fill")
                    .font(.system(size: 18))

                if appState.badgeCounts.notifications > 0 {
                    Text("\(appState.badgeCounts.notifications)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(4)
                        .background(Circle().fill(.red))
                        .offset(x: 8, y: -8)
                }
            }
        }
    }
}

struct UserAvatarButton: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationLink {
            SettingsTabView()
        } label: {
            ZStack {
                Circle()
                    .fill(ThemeManager.Colors.brandPrimary.opacity(0.15))
                    .frame(width: 32, height: 32)

                Text(appState.currentUser?.name.prefix(1).uppercased() ?? "U")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(ThemeManager.Colors.brandPrimary)
            }
        }
    }
}
