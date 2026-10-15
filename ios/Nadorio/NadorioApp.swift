import SwiftUI

@main struct NadorioApp: App {
    private let configuration = Result { try AppConfiguration.load() }
    var body: some Scene {
        WindowGroup {
            switch configuration {
            case .success(let configuration): NativeRoot(configuration: configuration)
            case .failure(let error): ContentUnavailableView("App setup required", systemImage: "gearshape", description: Text(error.localizedDescription))
            }
        }
    }
}

struct NativeRoot: View {
    @StateObject private var model: AppModel
    @Environment(\.scenePhase) private var phase
    init(configuration: AppConfiguration) { _model = StateObject(wrappedValue: AppModel(configuration: configuration)) }
    var body: some View {
        ZStack {
            Group {
                if model.starting { ProgressView("Opening NADORIO…") }
                else if model.account == nil { SignInView() }
                else if let workspace = model.workspace { PortalTabs(workspace: workspace).id(workspace.organization.id) }
                else { OrganizationPicker() }
            }
            if phase != .active { Color(uiColor: .systemBackground).ignoresSafeArea().overlay { Label("NADORIO", systemImage: "shield.lefthalf.filled").font(.title.bold()) } }
        }
        .environmentObject(model)
        .tint(.cyan)
        .preferredColorScheme(.dark)
        .task { await model.restore() }
        .alert("NADORIO", isPresented: Binding(get: { model.message != nil }, set: { if !$0 { model.message = nil } })) { Button("OK", role: .cancel) { model.message = nil } } message: { Text(model.message ?? "") }
    }
}
