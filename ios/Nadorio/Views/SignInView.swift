import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var model: AppModel
    @State private var email = ""
    @State private var password = ""
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "square.stack.3d.up.fill").font(.largeTitle).foregroundStyle(.cyan)
                        Text("NADORIO").font(.largeTitle.bold())
                        Text("Your organization. Always with you.").foregroundStyle(.secondary)
                    }.padding(.vertical)
                }
                Section {
                    TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(.password)
                    Button { Task { await model.login(email: email, password: password); password = "" } } label: {
                        HStack { Spacer(); if model.busy { ProgressView() }; Text(model.busy ? "Signing in…" : "Sign in"); Spacer() }.frame(minHeight: 44)
                    }.buttonStyle(.borderedProminent).disabled(model.busy || email.isEmpty || password.isEmpty)
                } header: { Text("Sign in to your existing account") } footer: { Text("Use the account provided by your organization. Manage password recovery through your organization's support team or existing NADORIO website.") }
                Section {
                    Link("Privacy policy", destination: model.configuration.privacyURL)
                    Link("Get support", destination: model.configuration.supportURL)
                }
            }.navigationTitle("Welcome")
        }
    }
}
