import SwiftUI

@MainActor final class AppModel: ObservableObject {
    let configuration: AppConfiguration
    let api: APIClient
    @Published var account: Account?
    @Published var workspace: Workspace?
    @Published var organizations: [Organization] = []
    @Published var message: String?
    @Published var starting = true
    @Published var busy = false
    private var membership: [Membership] = []
    private var platformOwner = false
    private var contextVersion = UUID()

    init(configuration: AppConfiguration) { self.configuration = configuration; api = APIClient(configuration: configuration) }
    func restore() async {
        defer { starting = false }
        do { account = try await api.restore(); if account != nil { try await loadOrganizations() } }
        catch { handle(error) }
    }
    func login(email: String, password: String) async {
        busy = true; defer { busy = false }
        do { account = try await api.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password); try await loadOrganizations() }
        catch { handle(error) }
    }
    func loadOrganizations() async throws {
        guard let account else { throw AppError.signedOut }
        // Page through RLS-filtered organizations and memberships; no service-role key exists in the app.
        var clubs: [Organization] = []; var offset = 0
        repeat {
            let page: [Organization] = try await api.rows("clubs", select: "id,name,status,logo_url", filters: ["status": "eq.active"], order: "name.asc,id.asc", offset: offset, limit: 100)
            clubs += page; if page.count < 100 { break }; offset += 100
        } while true
        var memberships: [Membership] = []; offset = 0
        repeat {
            let page: [Membership] = try await api.rows("club_users", select: "club_id,role,active", filters: ["user_id": "eq.\(account.id)", "active": "eq.true"], order: "club_id.asc", offset: offset, limit: 100)
            memberships += page; if page.count < 100 { break }; offset += 100
        } while true
        platformOwner = try await api.request("rest/v1/rpc/is_super_admin", method: "POST", body: [:])
        membership = memberships
        organizations = clubs.filter { club in platformOwner || memberships.contains(where: { $0.clubId == club.id && $0.active }) }
        if let current = workspace?.organization, let refreshed = organizations.first(where: { $0.id == current.id }) { try await select(refreshed) }
        else { workspace = nil; if let first = organizations.first { try await select(first) } }
    }
    func select(_ organization: Organization) async throws {
        guard let account else { throw AppError.signedOut }
        contextVersion = UUID(); let version = contextVersion
        // Clear the previous organization before awaiting new data to prevent cross-organization display.
        workspace = nil
        let filters = ["club_id": "eq.\(organization.id)"]
        async let licenses: [License] = api.rows("club_modules", filters: filters, limit: 100)
        async let permissions: [Permission] = api.rows("club_user_permissions", filters: filters.merging(["user_id": "eq.\(account.id)"]) { _, new in new }, limit: 100)
        async let catalog: [CatalogEntry] = api.rows("module_catalog", select: "module_key,available", limit: 100)
        let values = try await (licenses, permissions, catalog)
        guard version == contextVersion, self.account?.id == account.id else { return }
        let role = platformOwner ? "super_admin" : membership.first(where: { $0.clubId == organization.id && $0.active })?.role
        guard let role else { throw AppError.message("Organization access is no longer available.") }
        workspace = Workspace(organization: organization, role: role, licenses: values.0, permissions: values.1, catalog: values.2)
    }
    func logout() async {
        busy = true; defer { busy = false }
        do { try await api.signOut(); contextVersion = UUID(); account = nil; workspace = nil; organizations = []; membership = [] }
        catch { handle(error) }
    }
    func handle(_ error: Error) {
        if case AppError.signedOut = error { account = nil; workspace = nil; organizations = []; contextVersion = UUID() }
        message = error.localizedDescription
    }
}
