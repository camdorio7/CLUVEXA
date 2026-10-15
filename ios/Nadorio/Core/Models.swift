import Foundation

struct Account: Codable, Sendable { let id: UUID; let email: String? }
struct Session: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: TimeInterval
    let user: Account
}
struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Double
    let user: Account
    var session: Session { Session(accessToken: accessToken, refreshToken: refreshToken, expiresAt: Date().timeIntervalSince1970 + expiresIn, user: user) }
}
struct Organization: Decodable, Identifiable, Sendable {
    let id: UUID; let name: String; let status: String
    let logoUrl: String?
}
struct Membership: Decodable, Sendable { let clubId: UUID; let role: String; let active: Bool }
struct License: Decodable, Sendable {
    let moduleKey: String; let licensed: Bool; let clubEnabled: Bool; let memberVisible: Bool?
}
struct Permission: Decodable, Sendable {
    let moduleKey: String; let canView: Bool; let canCreate: Bool; let canEdit: Bool; let canDelete: Bool
}
struct CatalogEntry: Decodable, Sendable { let moduleKey: String; let available: Bool }
struct Workspace: Sendable {
    let organization: Organization
    let role: String
    let licenses: [License]
    let permissions: [Permission]
    let catalog: [CatalogEntry]
    var isAdmin: Bool { ["owner", "admin", "super_admin"].contains(role) }
    func allows(_ key: String, action: String = "view") -> Bool {
        guard organization.status == "active", catalog.contains(where: { $0.moduleKey == key && $0.available }),
              let license = licenses.first(where: { $0.moduleKey == key }), license.licensed, license.clubEnabled else { return false }
        if isAdmin { return true }
        if role == "member" { return action == "view" && ["members", "events", "communications"].contains(key) && license.memberVisible == true }
        guard ["staff", "manager"].contains(role), let grant = permissions.first(where: { $0.moduleKey == key }), grant.canView else { return false }
        switch action { case "create": return grant.canCreate; case "edit": return grant.canEdit; case "delete": return grant.canDelete; default: return action == "view" }
    }
}
struct Member: Decodable, Identifiable {
    let id: UUID; let fullName: String; let memberNumber: String?; let status: String
    let goodStanding: Bool; let phone: String?; let email: String?
}
struct ClubEvent: Decodable, Identifiable {
    let id: UUID; let title: String; let description: String?; let startsAt: String
    let location: String?; let capacity: Int?; let registrationDeadline: String?; let status: String
    var date: Date? { startsAt.serviceDate }
    var registrationClosed: Bool { status != "published" || (date ?? .distantPast) <= Date() || (registrationDeadline?.serviceDate ?? .distantFuture) <= Date() }
}
struct Registration: Decodable, Identifiable {
    let id: UUID; let eventId: UUID; let status: String
    let attendeeName: String?; let attendedAt: String?
}
struct EventCounts: Decodable { let eventId: UUID; let registered: Int; let waiting: Int }
struct RegistrationResult: Decodable { let id: UUID?; let status: String }
struct Announcement: Decodable, Identifiable {
    let id: UUID; let title: String; let body: String; let createdAt: String
}
struct WorkItem: Decodable, Identifiable {
    let id: UUID; let title: String; let status: String; let priority: String?
}
struct DeletionRequest: Decodable, Identifiable { let id: UUID; let status: String; let createdAt: String }
struct EmptyResponse: Decodable {}
