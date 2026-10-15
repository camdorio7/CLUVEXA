import XCTest
@testable import Nadorio

final class AccessTests: XCTestCase {
    private func workspace(role: String = "member", active: Bool = true, licensed: Bool = true, visible: Bool = true, grants: [Permission] = []) -> Workspace {
        Workspace(organization: Organization(id: UUID(), name: "Test", status: active ? "active" : "suspended", logoUrl: nil), role: role,
                  licenses: [License(moduleKey: "events", licensed: licensed, clubEnabled: true, memberVisible: visible)], permissions: grants,
                  catalog: [CatalogEntry(moduleKey: "events", available: true)])
    }
    func testMemberAccessCannotWriteOrBypassVisibility() {
        XCTAssertTrue(workspace().allows("events"))
        XCTAssertFalse(workspace().allows("events", action: "edit"))
        XCTAssertFalse(workspace(visible: false).allows("events"))
        XCTAssertFalse(workspace().allows("operations"))
    }
    func testAdminsCannotBypassOrganizationOrLicenseState() {
        XCTAssertTrue(workspace(role: "admin").allows("events", action: "edit"))
        XCTAssertFalse(workspace(role: "admin", active: false).allows("events"))
        XCTAssertFalse(workspace(role: "admin", licensed: false).allows("events"))
    }
    func testStaffNeedsExplicitActionPermission() {
        let grants = [Permission(moduleKey: "events", canView: true, canCreate: false, canEdit: true, canDelete: false)]
        XCTAssertFalse(workspace(role: "staff").allows("events"))
        XCTAssertTrue(workspace(role: "staff", grants: grants).allows("events", action: "edit"))
        XCTAssertFalse(workspace(role: "staff", grants: grants).allows("events", action: "create"))
    }
    func testSupabasePayloadDecoding() throws {
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let data = Data(#"{"event_id":"99000000-0000-0000-0000-000000000001","registered":2,"waiting":1}"#.utf8)
        let counts = try decoder.decode(EventCounts.self, from: data)
        XCTAssertEqual(counts.registered, 2); XCTAssertEqual(counts.waiting, 1)
        XCTAssertNotNil("2026-10-15T15:00:00.123+00:00".serviceDate)
        XCTAssertNotNil("2026-10-15T15:00:00Z".serviceDate)
        XCTAssertNil("invalid".serviceDate)
    }
}
