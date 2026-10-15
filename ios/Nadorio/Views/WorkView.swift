import SwiftUI

struct WorkView: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace
    @State private var tasks: [WorkItem] = []
    @State private var page = 0
    @State private var busy = false
    var body: some View {
        List {
            if workspace.allows("members") { NavigationLink("Member directory", systemImage: "person.2") { MemberDirectory(workspace: workspace) } }
            if workspace.allows("operations") {
                Section("Open tasks") {
                    ForEach(tasks) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.title).font(.headline)
                            if let priority = item.priority { Text(priority.capitalized).foregroundStyle(.secondary) }
                            if workspace.allows("operations", action: "edit") {
                                Button("Mark complete", systemImage: "checkmark.circle") { Task { await complete(item) } }.disabled(busy)
                            }
                        }
                    }
                    if tasks.isEmpty { Text("No open tasks to display.") }
                    if page > 0 { Button("Previous tasks") { page -= 1 } }
                    if tasks.count == 25 { Button("More tasks") { page += 1 } }
                }
            }
        }.navigationTitle("Workspace").task(id: page) { await load() }.refreshable { await load() }
    }
    private func load() async {
        guard workspace.allows("operations") else { return }
        do { tasks = try await model.api.rows("operational_tasks", filters: ["club_id": "eq.\(workspace.organization.id)", "status": "eq.open"], order: "created_at.desc,id.desc", offset: page * 25, limit: 25) }
        catch { model.handle(error) }
    }
    private func complete(_ item: WorkItem) async {
        busy = true; defer { busy = false }
        do {
            try await model.api.mutate("rest/v1/operational_tasks", method: "PATCH", query: [URLQueryItem(name: "id", value: "eq.\(item.id)"), URLQueryItem(name: "club_id", value: "eq.\(workspace.organization.id)")], body: ["status": "complete"])
            await load()
        } catch { model.handle(error) }
    }
}

private struct MemberDirectory: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace
    @State private var members: [Member] = []
    @State private var search = ""
    @State private var page = 0
    var body: some View {
        List {
            ForEach(members) { member in
                NavigationLink {
                    Form {
                        LabeledContent("Name", value: member.fullName)
                        LabeledContent("Number", value: member.memberNumber ?? "Not assigned")
                        LabeledContent("Status", value: member.status.capitalized)
                        LabeledContent("Standing", value: member.goodStanding ? "Good standing" : "Review required")
                        if let email = member.email { LabeledContent("Email", value: email).textSelection(.enabled) }
                        if let phone = member.phone { LabeledContent("Phone", value: phone).textSelection(.enabled) }
                    }.navigationTitle("Member")
                } label: { VStack(alignment: .leading) { Text(member.fullName); Text(member.memberNumber ?? member.status.capitalized).font(.caption).foregroundStyle(.secondary) } }
            }
            if members.isEmpty { Text("No matching members.") }
            if page > 0 { Button("Previous members") { page -= 1 } }
            if members.count == 25 { Button("More members") { page += 1 } }
        }.navigationTitle("Members").searchable(text: $search, prompt: "Search name")
            .onChange(of: search) { page = 0 }.task(id: "\(page):\(search)") { await load() }.refreshable { await load() }
    }
    private func load() async {
        do {
            try await Task.sleep(for: .milliseconds(300)); try Task.checkCancellation()
            var filters = ["club_id": "eq.\(workspace.organization.id)"]
            let term = search.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "*", with: "").replacingOccurrences(of: "%", with: "").replacingOccurrences(of: "_", with: "")
            if !term.isEmpty { filters["full_name"] = "ilike.*\(term)*" }
            let next: [Member] = try await model.api.rows("members", select: "id,full_name,member_number,status,good_standing,phone,email", filters: filters, order: "full_name.asc,id.asc", offset: page * 25, limit: 25)
            try Task.checkCancellation(); members = next
        } catch is CancellationError {} catch { model.handle(error) }
    }
}
