import SwiftUI

struct OrganizationPicker: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var switching = false
    var body: some View {
        NavigationStack {
            List {
                Section("Your organizations") {
                    ForEach(model.organizations) { organization in
                        Button {
                            switching = true
                            Task { do { try await model.select(organization); dismiss() } catch { model.handle(error) }; switching = false }
                        } label: { Label(organization.name, systemImage: "building.2").frame(minHeight: 44) }.disabled(switching)
                    }
                }
                if model.organizations.isEmpty {
                    ContentUnavailableView("No organizations yet", systemImage: "building.2", description: Text("Ask your organization administrator to activate your access."))
                }
                Button("Refresh organizations", systemImage: "arrow.clockwise") { Task { do { try await model.loadOrganizations() } catch { model.handle(error) } } }
                NavigationLink("Account & privacy") { AccountView(workspace: nil) }
                Button("Sign out", role: .destructive) { Task { await model.logout() } }.disabled(model.busy)
            }.navigationTitle("Organizations")
            .overlay { if switching { ProgressView("Opening organization…").padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)) } }
        }
    }
}

struct PortalTabs: View {
    let workspace: Workspace
    var body: some View {
        TabView {
            NavigationStack { HomeView(workspace: workspace) }.tabItem { Label("Home", systemImage: "house") }
            if workspace.allows("events") { NavigationStack { EventsView(workspace: workspace) }.tabItem { Label("Events", systemImage: "calendar") } }
            if workspace.allows("communications") { NavigationStack { AnnouncementsView(workspace: workspace) }.tabItem { Label("Updates", systemImage: "megaphone") } }
            if workspace.role != "member" && (workspace.allows("operations") || workspace.allows("members")) {
                NavigationStack { WorkView(workspace: workspace) }.tabItem { Label("Workspace", systemImage: "rectangle.grid.2x2") }
            }
            NavigationStack { AccountView(workspace: workspace) }.tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace
    @State private var member: Member?
    @State private var loading = true
    @State private var failed = false
    @State private var choosing = false
    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 14) {
                    Label("NADORIO", systemImage: "square.stack.3d.up.fill").font(.headline).foregroundStyle(.cyan)
                    Text(workspace.organization.name).font(.title.bold())
                    Text(workspace.role.replacingOccurrences(of: "_", with: " ").capitalized).foregroundStyle(.secondary)
                    Button("Switch organization", systemImage: "arrow.triangle.2.circlepath") { choosing = true }.buttonStyle(.bordered)
                }.padding(.vertical, 8)
            }.listRowBackground(LinearGradient(colors: [.blue.opacity(0.2), .purple.opacity(0.15)], startPoint: .topLeading, endPoint: .bottomTrailing))
            if loading { ProgressView("Loading membership…") }
            else if let member {
                Section("My membership") {
                    Label(member.fullName, systemImage: "person.text.rectangle").font(.title3.bold())
                    LabeledContent("Member number", value: member.memberNumber ?? "Not assigned")
                    LabeledContent("Status", value: member.status.capitalized)
                    Label(member.goodStanding ? "In good standing" : "Contact your organization", systemImage: member.goodStanding ? "checkmark.shield" : "exclamationmark.shield")
                        .foregroundStyle(member.goodStanding ? Color.green : Color.orange)
                    Text("Present this card when staff verify your membership. Staff must confirm your current eligibility in NADORIO.").font(.footnote).foregroundStyle(.secondary)
                }
            } else if failed { Button("Retry loading membership") { Task { await load() } } }
            else if workspace.role == "member" { Text("Your member record is not connected yet. Contact your organization administrator.") }
            Section("Your organization") {
                if workspace.allows("events") { NavigationLink { EventsView(workspace: workspace) } label: { Label("Upcoming events", systemImage: "calendar") } }
                if workspace.allows("communications") { NavigationLink { AnnouncementsView(workspace: workspace) } label: { Label("Latest announcements", systemImage: "megaphone") } }
                NavigationLink { AccountView(workspace: workspace) } label: { Label("Account & privacy", systemImage: "person.crop.circle") }
            }
        }.navigationTitle("Home")
            .sheet(isPresented: $choosing) { OrganizationPicker() }
            .task { await load() }
            .refreshable { do { try await model.loadOrganizations() } catch { model.handle(error) }; await load() }
    }
    private func load() async {
        loading = true; failed = false; defer { loading = false }
        guard let id = model.account?.id else { return }
        do {
            let records: [Member] = try await model.api.rows("members", select: "id,full_name,member_number,status,good_standing,phone,email", filters: ["club_id": "eq.\(workspace.organization.id)", "profile_id": "eq.\(id)"], limit: 1)
            member = records.first
        } catch { failed = true; model.handle(error) }
    }
}
