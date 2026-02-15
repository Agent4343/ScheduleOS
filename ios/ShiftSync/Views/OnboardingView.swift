import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @State private var currentPage = 0
    @State private var serverURL: String = AppConfig.defaultServerURL

    private let pages: [OnboardingPage] = [
        OnboardingPage(
            icon: "calendar.badge.clock",
            title: "Smart Scheduling",
            description: "AI-powered rotation management for complex shift patterns. From 2-on/2-off to 21-on/21-off and fully custom rotations.",
            gradient: [Color(hex: "2563EB"), Color(hex: "7C3AED")]
        ),
        OnboardingPage(
            icon: "person.3.fill",
            title: "Crew Management",
            description: "Organize workers into crews with automatic phase offsets and day/night transitions. Keep your workforce in perfect sync.",
            gradient: [Color(hex: "059669"), Color(hex: "0891B2")]
        ),
        OnboardingPage(
            icon: "bell.badge.fill",
            title: "Real-Time Alerts",
            description: "Get instant notifications for staffing gaps, time-off requests, and schedule changes. Never miss a critical update.",
            gradient: [Color(hex: "DC2626"), Color(hex: "F59E0B")]
        ),
        OnboardingPage(
            icon: "lock.shield.fill",
            title: "Secure & Private",
            description: "Face ID and Touch ID authentication. Your workforce data is encrypted and protected with enterprise-grade security.",
            gradient: [Color(hex: "7C3AED"), Color(hex: "EC4899")]
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Page content
            TabView(selection: $currentPage) {
                ForEach(0..<pages.count, id: \.self) { index in
                    OnboardingPageView(page: pages[index])
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut, value: currentPage)

            // Bottom section
            VStack(spacing: 20) {
                // Page indicators
                HStack(spacing: 10) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        Capsule()
                            .fill(index == currentPage ? ThemeManager.Colors.brandPrimary : Color.gray.opacity(0.3))
                            .frame(width: index == currentPage ? 28 : 10, height: 10)
                            .animation(.spring(response: 0.3), value: currentPage)
                    }
                }
                .padding(.bottom, 8)

                // Server URL configuration (only on last page)
                if currentPage == pages.count - 1 {
                    VStack(spacing: 12) {
                        Text("Server URL")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.secondary)

                        TextField("https://your-server.railway.app", text: $serverURL)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .padding(.horizontal, 32)
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                // Action button
                Button(action: {
                    HapticManager.shared.impact(style: .medium)
                    if currentPage < pages.count - 1 {
                        withAnimation {
                            currentPage += 1
                        }
                    } else {
                        completeOnboarding()
                    }
                }) {
                    HStack(spacing: 8) {
                        Text(currentPage < pages.count - 1 ? "Continue" : "Get Started")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                        Image(systemName: currentPage < pages.count - 1 ? "arrow.right" : "checkmark")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [ThemeManager.Colors.brandPrimary, ThemeManager.Colors.brandSecondary],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: ThemeManager.Colors.brandPrimary.opacity(0.4), radius: 12, y: 6)
                }
                .padding(.horizontal, 32)

                // Skip button
                if currentPage < pages.count - 1 {
                    Button("Skip") {
                        withAnimation {
                            currentPage = pages.count - 1
                        }
                    }
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.secondary)
                }
            }
            .padding(.bottom, 40)
        }
    }

    private func completeOnboarding() {
        if !serverURL.isEmpty {
            appState.serverURL = serverURL
        }
        withAnimation {
            appState.hasCompletedOnboarding = true
        }
    }
}

// MARK: - Onboarding Page Model
struct OnboardingPage {
    let icon: String
    let title: String
    let description: String
    let gradient: [Color]
}

// MARK: - Onboarding Page View
struct OnboardingPageView: View {
    let page: OnboardingPage
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Animated icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: page.gradient.map { $0.opacity(0.15) },
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 180, height: 180)
                    .scaleEffect(isAnimating ? 1.05 : 1.0)

                Circle()
                    .fill(
                        LinearGradient(
                            colors: page.gradient.map { $0.opacity(0.25) },
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 140, height: 140)

                Image(systemName: page.icon)
                    .font(.system(size: 56, weight: .medium))
                    .foregroundStyle(
                        LinearGradient(
                            colors: page.gradient,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .scaleEffect(isAnimating ? 1.1 : 1.0)
            }
            .animation(.easeInOut(duration: 2).repeatForever(autoreverses: true), value: isAnimating)

            VStack(spacing: 16) {
                Text(page.title)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)

                Text(page.description)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.horizontal, 32)
            }

            Spacer()
            Spacer()
        }
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
