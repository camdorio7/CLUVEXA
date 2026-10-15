import SwiftUI

struct AnnouncementsView: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace
    @State private var items: [Announcement] = []
    @State private var page = 0
    @State private var loading = true
    @State private var composing = false
    var body: some View {
        List {
            if loading { ProgressView("Loading updates…") }
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 10) {
                    Text(item.title).font(.headline)
                    Text(item.body).textSelection(.enabled)
                    if let date = item.createdAt.serviceDate { Text(date, style: .date).font(.caption).foregroundStyle(.secondary) }
                    ShareLink(item: "\(item.title)\n\n\(item.body)")
                }.padding(.vertical, 6)
            }
            if !loading && items.isEmpty { Text("No announcements to display.").foregroundStyle(.secondary) }
            if page > 0 { Button("Previous updates") { page -= 1 } }
            if items.count == 25 { Button("More updates") { page += 1 } }
        }.navigationTitle("Updates").task(id: page) { await load() }.refreshable { await load() }
            .toolbar { if workspace.allows("communications", action: "create") { Button("New announcement", systemImage: "square.and.pencil") { composing = true } } }
            .sheet(isPresented: $composing, onDismiss: { Task { await load() } }) { AnnouncementComposer(workspace: workspace) }
    }
    private func load() async {
        loading = true; defer { loading = false }
        do {
            let next: [Announcement] = try await model.api.rows("announcements", filters: ["club_id": "eq.\(workspace.organization.id)"], order: "created_at.desc,id.desc", offset: page * 25, limit: 25)
            try Task.checkCancellation(); items = next
        } catch is CancellationError {} catch { model.handle(error) }
    }
}

private struct AnnouncementComposer: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let workspace: Workspace
    @State private var title = ""
    @State private var bodyText = ""
    @State private var audience = "all"
    @State private var busy = false
    @State private var requestKey = UUID()
    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("Announcement", text: $bodyText, axis: .vertical).lineLimit(6...20)
                Picker("Audience", selection: $audience) { Text("Everyone").tag("all"); Text("Members").tag("members"); Text("Staff").tag("staff") }
                Text("Publishes an in-app announcement. Email delivery is managed in the web portal.").font(.footnote).foregroundStyle(.secondary)
            }.disabled(busy).navigationTitle("New announcement")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                    ToolbarItem(placement: .confirmationAction) { Button("Publish") { Task { await publish() } }.disabled(busy || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || title.count > 180 || bodyText.count > 12000) }
                }.interactiveDismissDisabled(busy)
                .onChange(of: title) { requestKey = UUID() }.onChange(of: bodyText) { requestKey = UUID() }.onChange(of: audience) { requestKey = UUID() }
        }
    }
    private func publish() async {
        busy = true; defer { busy = false }
        do {
            try await model.api.mutate("rest/v1/rpc/v12_publish_announcement", body: ["target_club": workspace.organization.id.uuidString, "request_key_value": requestKey.uuidString, "subject_value": title, "body_value": bodyText, "audience_value": audience, "email_value": false])
            dismiss()
        } catch { model.handle(error) }
    }
}
