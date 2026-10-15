import Foundation

struct AppConfiguration: Sendable {
    let supabaseURL: URL
    let anonKey: String
    let privacyURL: URL
    let supportURL: URL
    let deletionDays: Int

    static func load(bundle: Bundle = .main) throws -> AppConfiguration {
        guard let url = bundle.url(forResource: "Configuration", withExtension: "plist"),
              let dictionary = NSDictionary(contentsOf: url) as? [String: Any] else {
            throw AppError.message("The app needs its organization service configuration. Contact the app administrator.")
        }
        func endpoint(_ key: String) throws -> URL {
            guard let raw = dictionary[key] as? String, !raw.contains("YOUR_"),
                  let value = URL(string: raw), value.scheme == "https", value.host != nil,
                  value.user == nil, value.password == nil else {
                throw AppError.message("The app's service links are not configured.")
            }
            return value
        }
        guard let key = dictionary["SupabaseAnonKey"] as? String, !key.isEmpty, !key.contains("YOUR_") else {
            throw AppError.message("The app's public service key is not configured.")
        }
        let days = dictionary["DeletionProcessingDays"] as? Int ?? 7
        guard (1...30).contains(days) else { throw AppError.message("Account deletion processing time must be configured.") }
        return try AppConfiguration(supabaseURL: endpoint("SupabaseURL"), anonKey: key,
                                    privacyURL: endpoint("PrivacyURL"), supportURL: endpoint("SupportURL"), deletionDays: days)
    }
}

enum AppError: LocalizedError {
    case message(String)
    case signedOut
    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        case .signedOut: return "Your session has expired. Sign in again."
        }
    }
}

extension String {
    var serviceDate: Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: self) ?? ISO8601DateFormatter().date(from: self)
    }
}
