import SwiftUI

struct RootView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @State private var showSplash = true

    var body: some View {
        ZStack {
            if showSplash {
                SplashScreenView()
                    .transition(.opacity)
            } else if !appState.hasCompletedOnboarding {
                OnboardingView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing),
                        removal: .move(edge: .leading)
                    ))
            } else if !appState.isAuthenticated {
                LoginView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing),
                        removal: .opacity
                    ))
            } else {
                MainTabView()
                    .transition(.opacity)
            }

            // Offline banner
            if !networkMonitor.isConnected && !showSplash {
                VStack {
                    OfflineBannerView()
                    Spacer()
                }
                .transition(.move(edge: .top))
            }
        }
        .animation(.easeInOut(duration: 0.5), value: showSplash)
        .animation(.easeInOut(duration: 0.4), value: appState.isAuthenticated)
        .animation(.easeInOut(duration: 0.4), value: appState.hasCompletedOnboarding)
        .animation(.spring(response: 0.3), value: networkMonitor.isConnected)
        .onAppear {
            // Show splash for 2.2 seconds, then check auth
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
                withAnimation {
                    showSplash = false
                }
                // Try biometric auth if available
                if appState.hasCompletedOnboarding {
                    authManager.attemptBiometricAuth()
                }
            }
        }
    }
}

// MARK: - Splash Screen
struct SplashScreenView: View {
    @State private var logoScale: CGFloat = 0.5
    @State private var logoOpacity: Double = 0
    @State private var textOpacity: Double = 0
    @State private var ringRotation: Double = 0
    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                colors: [
                    ThemeManager.Colors.brandPrimary,
                    ThemeManager.Colors.brandPrimary.opacity(0.8),
                    ThemeManager.Colors.brandSecondary
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Animated background circles
            Circle()
                .fill(.white.opacity(0.05))
                .frame(width: 300, height: 300)
                .scaleEffect(pulseScale)
                .offset(x: -100, y: -200)

            Circle()
                .fill(.white.opacity(0.03))
                .frame(width: 400, height: 400)
                .scaleEffect(pulseScale * 0.8)
                .offset(x: 150, y: 250)

            VStack(spacing: 24) {
                // App icon with animated ring
                ZStack {
                    // Rotating ring
                    Circle()
                        .stroke(
                            AngularGradient(
                                colors: [.white.opacity(0.3), .white.opacity(0.8), .white.opacity(0.3)],
                                center: .center
                            ),
                            lineWidth: 3
                        )
                        .frame(width: 130, height: 130)
                        .rotationEffect(.degrees(ringRotation))

                    // Icon background
                    RoundedRectangle(cornerRadius: 28)
                        .fill(.white)
                        .frame(width: 110, height: 110)
                        .shadow(color: .black.opacity(0.2), radius: 20, y: 10)

                    // Icon content
                    VStack(spacing: 4) {
                        Image(systemName: "calendar.badge.clock")
                            .font(.system(size: 44, weight: .medium))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [ThemeManager.Colors.brandPrimary, ThemeManager.Colors.brandSecondary],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }
                }
                .scaleEffect(logoScale)
                .opacity(logoOpacity)

                // App name
                VStack(spacing: 8) {
                    Text("ShiftSync")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    Text("Workforce Scheduling Platform")
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.8))
                }
                .opacity(textOpacity)

                // Loading indicator
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.2)
                    .opacity(textOpacity)
                    .padding(.top, 20)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.6)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }
            withAnimation(.easeOut(duration: 0.8).delay(0.4)) {
                textOpacity = 1.0
            }
            withAnimation(.linear(duration: 3).repeatForever(autoreverses: false)) {
                ringRotation = 360
            }
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                pulseScale = 1.3
            }
        }
    }
}

// MARK: - Offline Banner
struct OfflineBannerView: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 14, weight: .semibold))
            Text("No Internet Connection")
                .font(.system(size: 14, weight: .semibold))
            Spacer()
            Text("Offline Mode")
                .font(.system(size: 12, weight: .medium))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.white.opacity(0.2))
                .clipShape(Capsule())
        }
        .foregroundColor(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.orange.opacity(0.95))
        .ignoresSafeArea(edges: .top)
    }
}
