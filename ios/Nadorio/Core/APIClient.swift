import Foundation

actor APIClient {
    let configuration: AppConfiguration
    private var session: Session?
    private var refreshTask: Task<Session, Error>?
    private var generation = UUID()
    private let transport: URLSession
    private let decoder: JSONDecoder

    init(configuration: AppConfiguration) {
        self.configuration = configuration
        let options = URLSessionConfiguration.ephemeral
        options.timeoutIntervalForRequest = 20
        options.timeoutIntervalForResource = 30
        options.urlCache = nil
        transport = URLSession(configuration: options)
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }
    func restore() async throws -> Account? {
        session = try SessionKeychain.load()
        guard session != nil else { return nil }
        return try await request("auth/v1/user")
    }
    func signIn(email: String, password: String) async throws -> Account {
        let result: AuthResponse = try await request("auth/v1/token", method: "POST", query: [URLQueryItem(name: "grant_type", value: "password")], body: ["email": email, "password": password], authenticated: false)
        generation = UUID()
        refreshTask?.cancel(); refreshTask = nil
        try SessionKeychain.save(result.session)
        session = result.session
        return result.user
    }
    func signOut() async throws {
        let token = session?.accessToken
        try SessionKeychain.clear()
        generation = UUID(); session = nil; refreshTask?.cancel(); refreshTask = nil
        if let token {
            // Local credentials are already cleared; a network failure cannot leave the app signed in.
            _ = try? await send("auth/v1/logout", method: "POST", query: [URLQueryItem(name: "scope", value: "local")], body: nil, token: token)
        }
    }
    private func token() async throws -> String {
        if let task = refreshTask {
            let expected = generation
            let next = try await task.value
            guard generation == expected, session != nil else { throw AppError.signedOut }
            return next.accessToken
        }
        guard let current = session else { throw AppError.signedOut }
        if current.expiresAt > Date().timeIntervalSince1970 + 60 { return current.accessToken }
        let expectedGeneration = generation
        let task = Task<Session, Error> {
            let data = try await self.send("auth/v1/token", method: "POST", query: [URLQueryItem(name: "grant_type", value: "refresh_token")], body: ["refresh_token": current.refreshToken], token: nil)
            return try self.decoder.decode(AuthResponse.self, from: data).session
        }
        refreshTask = task
        do {
            let next = try await task.value
            guard generation == expectedGeneration else { throw AppError.signedOut }
            try SessionKeychain.save(next); session = next; refreshTask = nil
            return next.accessToken
        } catch {
            if generation == expectedGeneration { refreshTask = nil }
            throw error
        }
    }
    func request<T: Decodable>(_ path: String, method: String = "GET", query: [URLQueryItem] = [], body: [String: Any]? = nil, authenticated: Bool = true) async throws -> T {
        let access = authenticated ? try await token() : nil
        let data = try await send(path, method: method, query: query, body: body, token: access)
        return try decoder.decode(T.self, from: data)
    }
    func mutate(_ path: String, method: String = "POST", query: [URLQueryItem] = [], body: [String: Any]) async throws {
        _ = try await send(path, method: method, query: query, body: body, token: try await token())
    }
    private func send(_ path: String, method: String, query: [URLQueryItem], body: [String: Any]?, token: String?) async throws -> Data {
        var components = URLComponents(url: configuration.supabaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue(configuration.anonKey, forHTTPHeaderField: "apikey")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await transport.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AppError.message("The server did not respond. Try again.") }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 && token != nil { throw AppError.signedOut }
            let info = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let code = info?["code"] as? String ?? ""
            if code == "PGRST202" { throw AppError.message("This feature needs a server update. Contact your organization administrator.") }
            let detail = info?["msg"] as? String ?? info?["message"] as? String ?? info?["error_description"] as? String
            throw AppError.message(detail ?? "The request could not complete (\(http.statusCode)). Please retry.")
        }
        return data
    }
    func rows<T: Decodable>(_ table: String, select: String = "*", filters: [String: String] = [:], order: String? = nil, offset: Int = 0, limit: Int = 50) async throws -> [T] {
        var query = [URLQueryItem(name: "select", value: select), URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "offset", value: String(offset))]
        query += filters.map { URLQueryItem(name: $0.key, value: $0.value) }
        if let order { query.append(URLQueryItem(name: "order", value: order)) }
        return try await request("rest/v1/\(table)", query: query)
    }
}
