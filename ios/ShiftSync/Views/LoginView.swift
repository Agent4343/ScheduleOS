import SwiftUI
import LocalAuthentication

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showPassword = false
    @State private var animateGradient = false
    @FocusState private var focusedField: LoginField?

    enum LoginField {
        case email, password
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Header with gradient
                ZStack {
                    LinearGradient(
                        colors: [
                            ThemeManager.Colors.brandPrimary,
                            animateGradient ? ThemeManager.Colors.brandSecondary : ThemeManager.Colors.brandPrimary.opacity(0.8)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .ignoresSafeArea(edges: .top)
                    .animation(.easeInOut(duration: 3).repeatForever(autoreverses: true), value: animateGradient)

                    VStack(spacing: 12) {
                        Image(systemName: "calendar.badge.clock")
                            .font(.system(size: 52, weight: .medium))
                            .foregroundColor(.white)
                            .padding(.top, 60)

                        Text("ShiftSync")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundColor(.white)

                        Text("Sign in to your account")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .padding(.bottom, 40)
                }
                .frame(height: 280)

                // Login form
                VStack(spacing: 24) {
                    // Email field
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Email", systemImage: "envelope.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.secondary)

                        TextField("you@company.com", text: $email)
                            .textFieldStyle(.plain)
                            .font(.system(size: 16))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .focused($focusedField, equals: .email)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(.systemGray6))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(focusedField == .email ? ThemeManager.Colors.brandPrimary : .clear, lineWidth: 2)
                            )
                    }

                    // Password field
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Password", systemImage: "lock.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.secondary)

                        HStack {
                            if showPassword {
                                TextField("Enter your password", text: $password)
                                    .textFieldStyle(.plain)
                                    .textContentType(.password)
                                    .focused($focusedField, equals: .password)
                            } else {
                                SecureField("Enter your password", text: $password)
                                    .textFieldStyle(.plain)
                                    .textContentType(.password)
                                    .focused($focusedField, equals: .password)
                            }

                            Button(action: { showPassword.toggle() }) {
                                Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                    .foregroundColor(.secondary)
                                    .font(.system(size: 16))
                            }
                        }
                        .font(.system(size: 16))
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(.systemGray6))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(focusedField == .password ? ThemeManager.Colors.brandPrimary : .clear, lineWidth: 2)
                        )
                    }

                    // Login button
                    Button(action: login) {
                        HStack(spacing: 10) {
                            if isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.9)
                            }
                            Text(isLoading ? "Signing In..." : "Sign In")
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: canSubmit
                                    ? [ThemeManager.Colors.brandPrimary, ThemeManager.Colors.brandSecondary]
                                    : [.gray, .gray],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(
                            color: canSubmit ? ThemeManager.Colors.brandPrimary.opacity(0.4) : .clear,
                            radius: 12,
                            y: 6
                        )
                    }
                    .disabled(!canSubmit || isLoading)

                    // Biometric auth button
                    if authManager.biometricType != .none && KeychainService.shared.hasStoredCredentials() {
                        Button(action: { authManager.attemptBiometricAuth() }) {
                            HStack(spacing: 10) {
                                Image(systemName: authManager.biometricType == .faceID ? "faceid" : "touchid")
                                    .font(.system(size: 22))
                                Text("Sign in with \(authManager.biometricType == .faceID ? "Face ID" : "Touch ID")")
                                    .font(.system(size: 16, weight: .semibold))
                            }
                            .foregroundColor(ThemeManager.Colors.brandPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(ThemeManager.Colors.brandPrimary, lineWidth: 2)
                            )
                        }
                    }

                    // Divider
                    HStack {
                        Rectangle()
                            .fill(Color(.separator))
                            .frame(height: 1)
                        Text("or")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                        Rectangle()
                            .fill(Color(.separator))
                            .frame(height: 1)
                    }

                    // Open in browser link
                    Button(action: {
                        if let url = URL(string: appState.serverURL) {
                            UIApplication.shared.open(url)
                        }
                    }) {
                        Label("Open in Browser", systemImage: "safari")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal, 28)
                .padding(.top, 32)
                .padding(.bottom, 40)
            }
        }
        .ignoresSafeArea(edges: .top)
        .alert("Sign In Error", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            animateGradient = true
        }
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && email.contains("@")
    }

    private func login() {
        guard canSubmit else { return }
        focusedField = nil
        isLoading = true
        HapticManager.shared.impact(style: .light)

        authManager.login(email: email, password: password, serverURL: appState.serverURL) { result in
            isLoading = false
            switch result {
            case .success(let user):
                HapticManager.shared.notification(type: .success)
                appState.currentUser = user
                appState.isAuthenticated = true
                // Store credentials for biometric auth
                KeychainService.shared.storeCredentials(email: email, password: password)
            case .failure(let error):
                HapticManager.shared.notification(type: .error)
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }
}
