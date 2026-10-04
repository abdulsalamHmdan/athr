import Foundation
import Security

protocol AuthTokenStore {
    var token: String? { get set }
}

final class KeychainTokenStore: AuthTokenStore {
    private let service = "sa.org.utq.atharquest"
    private let account = "ambassador-access-token"

    var token: String? {
        get {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]

            var result: CFTypeRef?
            guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
                  let data = result as? Data else {
                return nil
            }
            return String(data: data, encoding: .utf8)
        }
        set {
            let deleteQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account
            ]
            SecItemDelete(deleteQuery as CFDictionary)

            guard let newValue, let data = newValue.data(using: .utf8) else { return }
            let addQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            ]
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }
}

final class MemoryTokenStore: AuthTokenStore {
    var token: String?

    init(token: String? = nil) {
        self.token = token
    }
}
