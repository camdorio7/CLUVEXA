import SwiftUI
import EventKit
import EventKitUI

struct EventsView: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace
    @State private var events: [ClubEvent] = []
    @State private var registrations: [Registration] = []
    @State private var counts: [EventCounts] = []
    @State private var page = 0
    @State private var loading = true
    @State private var busy = false
    @State private var cancelling: ClubEvent?
    @State private var notice: String?
    @State private var calendarEvent: ClubEvent?
    @State private var calendarStore = EKEventStore()
    var body: some View {
        List {
            if loading { ProgressView("Loading events…") }
            if let notice { Text(notice).foregroundStyle(.secondary).accessibilityAddTraits(.updatesFrequently) }
            ForEach(events) { event in
                Section {
                    Text(event.title).font(.headline)
                    if let date = event.date { Text(date, format: .dateTime.weekday().month().day().hour().minute()) }
                    if let location = event.location, !location.isEmpty { Label(location, systemImage: "mappin.and.ellipse") }
                    if let description = event.description { Text(description).foregroundStyle(.secondary) }
                    let total = counts.first(where: { $0.eventId == event.id })
                    Text("\(total?.registered ?? 0) registered · \(total?.waiting ?? 0) waiting").font(.footnote)
                    if workspace.role == "member" {
                        let mine = registrations.first(where: { $0.eventId == event.id && ["registered", "waitlisted"].contains($0.status) })
                        if let mine {
                            Label(mine.status == "waitlisted" ? "You are on the waitlist" : "You are registered", systemImage: mine.status == "waitlisted" ? "clock" : "checkmark.circle")
                            Button("Cancel my registration", role: .destructive) { cancelling = event }.disabled(busy)
                        } else {
                            Button(event.registrationClosed ? "Registration closed" : ((event.capacity.map { (total?.registered ?? 0) >= $0 } ?? false) ? "Join waitlist" : "Register")) { Task { await register(event, cancel: false) } }
                                .buttonStyle(.borderedProminent).disabled(busy || event.registrationClosed)
                        }
                    }
                    HStack {
                        Button("Add to Calendar", systemImage: "calendar.badge.plus") { Task { await addToCalendar(event) } }.disabled(busy || event.date == nil)
                        Spacer()
                        ShareLink(item: "\(event.title)\n\(event.date?.formatted() ?? event.startsAt)\n\(event.location ?? "")") { Image(systemName: "square.and.arrow.up").accessibilityLabel("Share event") }
                    }.frame(minHeight: 44)
                    if workspace.allows("events", action: "edit") { NavigationLink("Attendance & waitlist") { AttendanceView(workspace: workspace, event: event) } }
                }
            }
            if !loading && events.isEmpty { ContentUnavailableView("No upcoming events", systemImage: "calendar", description: Text("Pull down to refresh.")) }
            Section {
                HStack {
                    Button("Previous") { page -= 1 }.disabled(page == 0 || busy || loading)
                    Spacer(); Text("Page \(page + 1)").font(.footnote); Spacer()
                    Button("Next") { page += 1 }.disabled(events.count < 25 || busy || loading)
                }
            }
        }.navigationTitle("Events")
            .task(id: page) { await load() }.refreshable { await load() }
            .confirmationDialog("Cancel your registration?", isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }), titleVisibility: .visible) {
                Button("Cancel registration", role: .destructive) { if let event = cancelling { Task { await register(event, cancel: true) } }; cancelling = nil }
            }
            .sheet(item: $calendarEvent) { event in CalendarEditor(event: event, store: calendarStore) }
    }
    private func load() async {
        loading = true; defer { loading = false }
        do {
            let list: [ClubEvent] = try await model.api.rows("club_events", filters: ["club_id": "eq.\(workspace.organization.id)", "status": "eq.published", "starts_at": "gte.\(ISO8601DateFormatter().string(from: Date()))"], order: "starts_at.asc,id.asc", offset: page * 25, limit: 25)
            let totals: [EventCounts] = try await model.api.request("rest/v1/rpc/v12_event_counts", method: "POST", body: ["target_club": workspace.organization.id.uuidString, "event_ids": list.map { $0.id.uuidString }])
            var mine: [Registration] = []
            if let user = model.account?.id, !list.isEmpty {
                mine = try await model.api.rows("event_registrations", filters: ["club_id": "eq.\(workspace.organization.id)", "user_id": "eq.\(user)", "event_id": "in.(\(list.map { $0.id.uuidString }.joined(separator: ",")))"], limit: 25)
            }
            try Task.checkCancellation(); events = list; counts = totals; registrations = mine
        } catch is CancellationError {} catch { model.handle(error) }
    }
    private func register(_ event: ClubEvent, cancel: Bool) async {
        busy = true; defer { busy = false }
        do {
            let result: RegistrationResult = try await model.api.request("rest/v1/rpc/v12_register_event", method: "POST", body: ["target_event": event.id.uuidString, "cancel": cancel])
            notice = result.status == "waitlisted" ? "You joined the waitlist. Your organization will confirm when a seat opens." : result.status == "cancelled" ? "Registration cancelled." : "Your registration is confirmed."
            await load()
        } catch { model.handle(error) }
    }
    private func addToCalendar(_ event: ClubEvent) async {
        busy = true; defer { busy = false }
        do {
            guard try await calendarStore.requestWriteOnlyAccessToEvents() else { throw AppError.message("Calendar access was not granted. You can enable it in iOS Settings.") }
            calendarEvent = event
        } catch { model.handle(error) }
    }
}

struct CalendarEditor: UIViewControllerRepresentable {
    let event: ClubEvent
    let store: EKEventStore
    @Environment(\.dismiss) private var dismiss
    func makeCoordinator() -> Coordinator { Coordinator { dismiss() } }
    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let controller = EKEventEditViewController(); controller.eventStore = store
        let item = EKEvent(eventStore: store); item.title = event.title; item.location = event.location; item.notes = event.description
        item.startDate = event.date ?? Date(); item.endDate = item.startDate.addingTimeInterval(3600)
        // Duration is editable in Apple's confirmation sheet because NADORIO stores a start time only.
        controller.event = item; controller.editViewDelegate = context.coordinator
        return controller
    }
    func updateUIViewController(_ uiViewController: EKEventEditViewController, context: Context) {}
    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let close: () -> Void
        init(close: @escaping () -> Void) { self.close = close }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) { close() }
    }
}

struct AttendanceView: View {
    @EnvironmentObject private var model: AppModel
    let workspace: Workspace
    let event: ClubEvent
    @State private var rows: [Registration] = []
    @State private var page = 0
    @State private var busy = false
    var body: some View {
        List {
            ForEach(rows) { registration in
                VStack(alignment: .leading, spacing: 10) {
                    Text(registration.attendeeName ?? "Member").font(.headline)
                    Text(registration.status.capitalized).foregroundStyle(.secondary)
                    if registration.status == "registered" {
                        Button(registration.attendedAt == nil ? "Mark attended" : "Undo check-in", systemImage: registration.attendedAt == nil ? "person.badge.plus" : "checkmark.circle.fill") {
                            Task { busy = true; defer { busy = false }; do { try await model.api.mutate("rest/v1/rpc/v12_attendance", body: ["registration_id": registration.id.uuidString, "present": registration.attendedAt == nil]); await load() } catch { model.handle(error) } }
                        }.disabled(busy)
                    }
                }.padding(.vertical, 6)
            }
            HStack { Button("Previous") { page -= 1 }.disabled(page == 0 || busy); Spacer(); Button("Next") { page += 1 }.disabled(rows.count < 50 || busy) }
        }.navigationTitle(event.title).task(id: page) { await load() }.refreshable { await load() }
    }
    private func load() async {
        do { let result: [Registration] = try await model.api.rows("event_registrations", filters: ["club_id": "eq.\(workspace.organization.id)", "event_id": "eq.\(event.id)", "status": "in.(registered,waitlisted)"], order: "created_at.asc,id.asc", offset: page * 50); try Task.checkCancellation(); rows = result }
        catch is CancellationError {} catch { model.handle(error) }
    }
}
