import Foundation

final class PersistenceStore {
    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private enum Key {
        static let snapshot = "athar.local.snapshot.v1"
        static let onboarding = "athar.onboarding.completed.v1"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var hasCompletedOnboarding: Bool {
        get { defaults.bool(forKey: Key.onboarding) }
        set { defaults.set(newValue, forKey: Key.onboarding) }
    }

    func loadSnapshot() -> LocalSnapshot? {
        guard let data = defaults.data(forKey: Key.snapshot) else { return nil }
        return try? decoder.decode(LocalSnapshot.self, from: data)
    }

    func save(_ snapshot: LocalSnapshot) {
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: Key.snapshot)
    }

    func reset() {
        defaults.removeObject(forKey: Key.snapshot)
        defaults.removeObject(forKey: Key.onboarding)
    }
}
