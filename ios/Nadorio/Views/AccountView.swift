import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace?
    @State private var phone = ""
    @State private var hasMember = false
    @State private var busy = false
    @State private var confirmingDeletion = false
    @State private var request: DeletionRequest?
    @State private var notice: String?
    var body: some View {
        Form {
            Section("Signed in") { Text(model.account?.email ?? "NADORIO account").textSelection(.enabled) }
            if hasMember {
                Section("My contact details") {
                    TextField("Phone", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                    Button("Save phone number") { Task { await savePhone() } }.disabled(busy || phone.count > 60)
                }
            }
            Section("Privacy & support") {
                Link("Privacy policy", destination: model.configuration.privacyURL)
                Link("Contact support", destination: model.configuration.supportURL)
                if let request {
                    LabeledContent("Deletion request", value: request.status.replacingOccurrences(of: "_", with: " ").capitalized)
                    Text("Reference: \(request.id.uuidString)").font(.caption).textSelection(.enabled)
                    Text("Your request is awaiting processing. Your account has not yet been deleted.").font(.footnote)
                } else {
                    Button("Request account deletion", role: .destructive) { confirmingDeletion = true }.disabled(busy)
                }
                Text("Deletion removes your NADORIO sign-in across all organizations. Our team processes requests within \(model.configuration.deletionDays) days and explains any records retained under the privacy policy. Organization subscriptions are managed separately by your organization.").font(.footnote).foregroundStyle(.secondary)
            }
            Button("Sign out", role: .destructive) { Task { await model.logout() } }.disabled(model.busy || busy)
            if let notice { Text(notice).foregroundStyle(.secondary).accessibilityAddTraits(.updatesFrequently) }
        }.navigationTitle("Account").task { await load() }.refreshable { await load() }
            .confirmationDialog("Request deletion of your NADORIO account across all organizations?", isPresented: $confirmingDeletion, titleVisibility: .visible) {
                Button("Request account deletion", role: .destructive) { Task { await deleteAccount() } }
                Button("Cancel", role: .cancel) {}
            } message: { Text("This starts a manual deletion request. Processing takes up to \(model.configuration.deletionDays) days. You can continue signing in until the account is removed.") }
    }
    private func load() async {
        guard let user = model.account else { return }
        do {
            let requests: [DeletionRequest] = try await model.api.rows("account_deletion_requests", filters: ["user_id": "eq.\(user.id)"], order: "created_at.desc", limit: 1)
            request = requests.first
            if let workspace {
                let members: [Member] = try await model.api.rows("members", select: "id,full_name,member_number,status,good_standing,phone,email", filters: ["club_id": "eq.\(workspace.organization.id)", "profile_id": "eq.\(user.id)"], limit: 1)
                hasMember = members.first != nil; phone = members.first?.phone ?? ""
            }
        } catch { model.handle(error) }
    }
    private func savePhone() async {
        guard let workspace else { return }
        busy = true; defer { busy = false }
        do {
            try await model.api.mutate("rest/v1/rpc/v11_update_phone", body: ["target_club": workspace.organization.id.uuidString, "phone_value": phone])
            notice = "Phone number saved."
        } catch { model.handle(error) }
    }
    private func deleteAccount() async {
        busy = true; defer { busy = false }
        do {
            let _: UUID = try await model.api.request("rest/v1/rpc/request_account_deletion", method: "POST", body: [:])
            notice = "Deletion request received. Your account has not yet been deleted."
            await load()
        } catch { model.handle(error) }
    }
}
