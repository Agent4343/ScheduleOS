import Foundation
import Security

// MARK: - Keychain Service
class KeychainService {
    static let shared = KeychainService()

    private let service = "com.shiftsync.app"
    private let emailKey = "user_email"
    private let passwordKey = "user_password"
    private let tokenKey = "auth_token"

    private init() {}

    // MARK: - Credentials
    func storeCredentials(email: String, password: String) {
        save(key: emailKey, data: email)
        save(key: passwordKey, data: password)
    }

    func getCredentials() -> (email: String, password: String)? {
        guard let email = load(key: emailKey),
              let password = load(key: passwordKey) else {
            return nil
        }
        return (email, password)
    }

    func hasStoredCredentials() -> Bool {
        return load(key: emailKey) != nil && load(key: passwordKey) != nil
    }

    func deleteCredentials() {
        delete(key: emailKey)
        delete(key: passwordKey)
    }

    // MARK: - Auth Token
    func storeToken(_ token: String) {
        save(key: tokenKey, data: token)
    }

    func getToken() -> String? {
        return load(key: tokenKey)
    }

    func deleteToken() {
        delete(key: tokenKey)
        deleteCredentials()
    }

    // MARK: - Private Helpers
    private func save(key: String, data: String) {
        guard let data = data.data(using: .utf8) else { return }

        // Delete existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    private func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
