import SwiftUI
import LocalAuthentication
import Combine
import WebKit

// MARK: - Authentication Manager
class AuthenticationManager: ObservableObject {
    @Published var biometricType: BiometricType = .none
    @Published var isAuthenticating = false

    enum BiometricType {
        case none, touchID, faceID
    }

    enum AuthError: Error, LocalizedError {
        case invalidCredentials
        case networkError
        case serverError(String)
        case biometricFailed
        case noStoredCredentials

        var errorDescription: String? {
            switch self {
            case .invalidCredentials: return "Invalid email or password"
            case .networkError: return "Unable to connect to the server"
            case .serverError(let msg): return msg
            case .biometricFailed: return "Biometric authentication failed"
            case .noStoredCredentials: return "No stored credentials found"
            }
        }
    }

    init() {
        checkBiometricAvailability()
    }

    // MARK: - Biometric Authentication
    func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            switch context.biometryType {
            case .faceID:
                biometricType = .faceID
            case .touchID:
                biometricType = .touchID
            default:
                biometricType = .none
            }
        }
    }

    func attemptBiometricAuth() {
        guard AppConfig.biometricAuthEnabled else { return }
        guard biometricType != .none else { return }
        guard KeychainService.shared.hasStoredCredentials() else { return }

        let context = LAContext()
        let reason = "Sign in to ShiftSync"

        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    // Retrieve stored credentials and auto-login
                    if let creds = KeychainService.shared.getCredentials() {
                        // Post notification to trigger login
                        NotificationCenter.default.post(
                            name: .biometricAuthSuccess,
                            object: nil,
                            userInfo: ["email": creds.email, "password": creds.password]
                        )
                    }
                }
            }
        }
    }

    // MARK: - Credential Login
    func login(
        email: String,
        password: String,
        serverURL: String,
        completion: @escaping (Result<ShiftSyncUser, AuthError>) -> Void
    ) {
        guard let url = URL(string: "\(serverURL)/api/auth/callback/credentials") else {
            completion(.failure(.networkError))
            return
        }

        isAuthenticating = true

        // First, get the CSRF token
        getCsrfToken(serverURL: serverURL) { [weak self] csrfResult in
            switch csrfResult {
            case .success(let csrfToken):
                self?.performLogin(
                    url: url,
                    email: email,
                    password: password,
                    csrfToken: csrfToken,
                    serverURL: serverURL,
                    completion: completion
                )
            case .failure:
                // Try direct login without CSRF
                self?.performDirectLogin(
                    email: email,
                    password: password,
                    serverURL: serverURL,
                    completion: completion
                )
            }
        }
    }

    private func getCsrfToken(serverURL: String, completion: @escaping (Result<String, AuthError>) -> Void) {
        guard let url = URL(string: "\(serverURL)/api/auth/csrf") else {
            completion(.failure(.networkError))
            return
        }

        URLSession.shared.dataTask(with: url) { data, _, error in
            if let error = error {
                completion(.failure(.networkError))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = json["csrfToken"] as? String else {
                completion(.failure(.serverError("Could not get CSRF token")))
                return
            }

            completion(.success(token))
        }.resume()
    }

    private static let formURLEncodingAllowed: CharacterSet = {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return allowed
    }()

    private func performLogin(
        url: URL,
        email: String,
        password: String,
        csrfToken: String,
        serverURL: String,
        completion: @escaping (Result<ShiftSyncUser, AuthError>) -> Void
    ) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let encode = { (value: String) -> String in
            value.addingPercentEncoding(withAllowedCharacters: Self.formURLEncodingAllowed) ?? ""
        }
        let body = "email=\(encode(email))&password=\(encode(password))&csrfToken=\(encode(csrfToken))"
        request.httpBody = body.data(using: .utf8)

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isAuthenticating = false

                if error != nil {
                    completion(.failure(.networkError))
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    completion(.failure(.networkError))
                    return
                }

                if httpResponse.statusCode == 200 || httpResponse.statusCode == 302 {
                    // Fetch session to get user info
                    self?.fetchSession(serverURL: serverURL, completion: completion)
                } else {
                    completion(.failure(.invalidCredentials))
                }
            }
        }.resume()
    }

    private func performDirectLogin(
        email: String,
        password: String,
        serverURL: String,
        completion: @escaping (Result<ShiftSyncUser, AuthError>) -> Void
    ) {
        guard let url = URL(string: "\(serverURL)/api/auth/signin") else {
            completion(.failure(.networkError))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["email": email, "password": password]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            DispatchQueue.main.async {
                self?.isAuthenticating = false

                if error != nil {
                    completion(.failure(.networkError))
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    completion(.failure(.networkError))
                    return
                }

                if (200...399).contains(httpResponse.statusCode) {
                    self?.fetchSession(serverURL: serverURL, completion: completion)
                } else {
                    completion(.failure(.invalidCredentials))
                }
            }
        }.resume()
    }

    private func fetchSession(serverURL: String, completion: @escaping (Result<ShiftSyncUser, AuthError>) -> Void) {
        guard let url = URL(string: "\(serverURL)/api/auth/session") else {
            completion(.failure(.networkError))
            return
        }

        URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
            if error != nil {
                DispatchQueue.main.async { completion(.failure(.networkError)) }
                return
            }

            guard let data = data else {
                DispatchQueue.main.async { completion(.failure(.networkError)) }
                return
            }

            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let user = json["user"] as? [String: Any] {
                    let shiftSyncUser = ShiftSyncUser(
                        id: user["id"] as? String ?? "",
                        email: user["email"] as? String ?? "",
                        name: user["name"] as? String ?? "",
                        role: UserRole(rawValue: user["role"] as? String ?? "WORKER") ?? .WORKER,
                        crewId: user["crewId"] as? String,
                        crewName: user["crewName"] as? String,
                        organizationId: user["organizationId"] as? String ?? "",
                        organizationName: user["organizationName"] as? String
                    )
                    // Sync cookies to WKWebView before completing login
                    self?.syncCookiesToWebView(serverURL: serverURL) {
                        DispatchQueue.main.async {
                            completion(.success(shiftSyncUser))
                        }
                    }
                } else {
                    DispatchQueue.main.async { completion(.failure(.invalidCredentials)) }
                }
            } catch {
                DispatchQueue.main.async { completion(.failure(.serverError("Failed to parse session"))) }
            }
        }.resume()
    }

    /// Sync all cookies for the server domain from URLSession's HTTPCookieStorage
    /// to WKWebView's WKHTTPCookieStore so the web views are authenticated.
    private func syncCookiesToWebView(serverURL: String, completion: @escaping () -> Void) {
        guard let serverURLObj = URL(string: serverURL),
              let host = serverURLObj.host else {
            completion()
            return
        }

        let cookieStore = WKWebsiteDataStore.default().httpCookieStore
        let cookies = HTTPCookieStorage.shared.cookies?.filter { $0.domain.contains(host) || host.contains($0.domain) } ?? []

        guard !cookies.isEmpty else {
            completion()
            return
        }

        let group = DispatchGroup()
        for cookie in cookies {
            group.enter()
            cookieStore.setCookie(cookie) {
                group.leave()
            }
        }
        group.notify(queue: .main) {
            completion()
        }
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let biometricAuthSuccess = Notification.Name("biometricAuthSuccess")
}
