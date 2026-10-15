import Foundation
import Security

enum SessionKeychain {
    private static let service = "com.cd7technologies.nadorio.session"
    static func save(_ session: Session) throws {
        let data = try JSONEncoder().encode(session)
        let key: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session"]
        let update = SecItemUpdate(key as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecSuccess { return }
        guard update == errSecItemNotFound else { throw AppError.message("Unable to securely save your session.") }
        var item = key
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw AppError.message("Unable to securely save your session.") }
    }
    static func load() throws -> Session? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                    kSecAttrAccount as String: "session", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw AppError.message("Unlock your device to restore your session.") }
        return try JSONDecoder().decode(Session.self, from: data)
    }
    static func clear() throws {
        let status = SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session"] as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw AppError.message("Your secure session could not be removed. Please retry.") }
    }
}
