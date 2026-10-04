import Foundation

enum AppEnvironment {
    static var usesDemoData: Bool {
        #if DEBUG
        let value = Bundle.main.object(forInfoDictionaryKey: "ATHAR_API_MODE") as? String
        return value?.lowercased() == "demo"
        #else
        return false
        #endif
    }

    static var apiBaseURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ATHAR_API_BASE_URL") as? String,
              !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return URL(string: value)
    }

    static func makeAPI() -> any AmbassadorAPI {
        if usesDemoData { return MockAmbassadorAPI() }
        return LiveAmbassadorAPI(baseURL: apiBaseURL ?? URL(string: "https://invalid.invalid")!)
    }
}
