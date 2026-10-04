import Foundation
import CryptoKit

struct GameCompletionPayload: Codable {
    var level: Int
    var stars: Int
    var elapsedSeconds: Int
    var playStyle: PlayStyle
}

protocol AmbassadorAPI {
    func fetchDashboard() async throws -> DashboardPayload
    func createBox(_ request: CreateBoxRequest) async throws -> MemorialOpportunity
    func redeem(productID: String, shippingAddress: String) async throws -> RedemptionReceipt
    func claimMission(id: String) async throws -> AmbassadorMission
    func recordShare(resourceID: String?, destination: String) async throws
    func completeGame(_ payload: GameCompletionPayload) async throws
}

enum APIError: LocalizedError {
    case invalidConfiguration
    case invalidResponse
    case unauthorized
    case server(status: Int, message: String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            "لم يكتمل إعداد عنوان الخادم. راجع إعدادات الاتصال."
        case .invalidResponse:
            "وصل رد غير متوقع من الخادم."
        case .unauthorized:
            "انتهت جلسة الدخول، سجّل الدخول مرة أخرى."
        case let .server(_, message):
            message
        case .decoding:
            "تعذّر قراءة بيانات الحساب."
        }
    }
}

struct EmptyResponse: Codable { }

private struct RedemptionRequest: Codable {
    let productID: String
    let shippingAddress: String
}

private struct MissionClaimRequest: Codable {
    let missionID: String
}

private struct ShareEventRequest: Codable {
    let resourceID: String?
    let destination: String
}

final class LiveAmbassadorAPI: AmbassadorAPI {
    let client: APIClient
    private var authTokenStore: AuthTokenStore

    init(baseURL: URL, tokenStore: AuthTokenStore = KeychainTokenStore()) {
        self.authTokenStore = tokenStore
        self.client = APIClient(baseURL: baseURL, tokenStore: tokenStore)
    }

    func fetchDashboard() async throws -> DashboardPayload {
        try await client.send(path: "v1/ambassador/dashboard", method: .get)
    }

    func createBox(_ request: CreateBoxRequest) async throws -> MemorialOpportunity {
        try await client.send(path: "v1/ambassador/boxes", method: .post, body: request)
    }

    func redeem(productID: String, shippingAddress: String) async throws -> RedemptionReceipt {
        try await client.send(
            path: "v1/ambassador/store/redemptions",
            method: .post,
            body: RedemptionRequest(productID: productID, shippingAddress: shippingAddress)
        )
    }

    func claimMission(id: String) async throws -> AmbassadorMission {
        try await client.send(
            path: "v1/ambassador/missions/claim",
            method: .post,
            body: MissionClaimRequest(missionID: id)
        )
    }

    func recordShare(resourceID: String?, destination: String) async throws {
        let _: EmptyResponse = try await client.send(
            path: "v1/ambassador/events/share",
            method: .post,
            body: ShareEventRequest(resourceID: resourceID, destination: destination)
        )
    }

    func completeGame(_ payload: GameCompletionPayload) async throws {
        let _: EmptyResponse = try await client.send(
            path: "v1/ambassador/game/completions",
            method: .post,
            body: payload
        )
    }
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
}

final class APIClient {
    private let baseURL: URL
    private let tokenStore: AuthTokenStore
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL, tokenStore: AuthTokenStore, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.tokenStore = tokenStore
        self.session = session

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
    }

    func send<Response: Decodable>(path: String, method: HTTPMethod) async throws -> Response {
        try await send(path: path, method: method, encodedBody: nil)
    }

    func send<Response: Decodable, Body: Encodable>(
        path: String,
        method: HTTPMethod,
        body: Body
    ) async throws -> Response {
        let bodyData = try encoder.encode(body)
        return try await send(path: path, method: method, encodedBody: bodyData)
    }

    private func send<Response: Decodable>(
        path: String,
        method: HTTPMethod,
        encodedBody: Data?
    ) async throws -> Response {
        guard baseURL.scheme == "https", baseURL.host != "invalid.invalid" else { throw APIError.invalidConfiguration }
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method.rawValue
        request.httpBody = encodedBody
        request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ar-SA", forHTTPHeaderField: "Accept-Language")

        if let token = tokenStore.token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Reuse an operation key across timeouts and app restarts; never retry a purchase as a new order.
        var operationStorageKey: String?
        if method == .post && !path.hasPrefix("v1/auth/") {
            var fingerprint = Data((baseURL.absoluteString + path + (tokenStore.token ?? "")).utf8)
            fingerprint.append(encodedBody ?? Data())
            let digest = SHA256.hash(data: fingerprint).map { String(format: "%02x", $0) }.joined()
            let storageKey = "athar.pending." + digest
            let key = UserDefaults.standard.string(forKey: storageKey) ?? UUID().uuidString
            UserDefaults.standard.set(key, forKey: storageKey)
            request.setValue(key, forHTTPHeaderField: "Idempotency-Key")
            operationStorageKey = storageKey
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if let operationStorageKey,
           (400..<500 ~= http.statusCode && ![408, 429].contains(http.statusCode)) {
            UserDefaults.standard.removeObject(forKey: operationStorageKey)
        }
        if http.statusCode == 401 {
            if !path.hasPrefix("v1/auth/") {
                NotificationCenter.default.post(name: .atharSessionExpired, object: nil)
            }
            throw APIError.unauthorized
        }
        guard 200..<300 ~= http.statusCode else {
            let message = (try? decoder.decode(ServerErrorEnvelope.self, from: data).message)
                ?? "تعذّر إتمام العملية الآن. حاول لاحقًا."
            throw APIError.server(status: http.statusCode, message: message)
        }

        if Response.self == EmptyResponse.self, data.isEmpty {
            if let operationStorageKey { UserDefaults.standard.removeObject(forKey: operationStorageKey) }
            return EmptyResponse() as! Response
        }

        do {
            let decoded = try decoder.decode(Response.self, from: data)
            if let operationStorageKey { UserDefaults.standard.removeObject(forKey: operationStorageKey) }
            return decoded
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private struct ServerErrorEnvelope: Decodable {
    let message: String
}


extension Notification.Name {
    static let atharSessionExpired = Notification.Name("atharSessionExpired")
}
struct AtharLoginRequest: Encodable { let phone: String; let password: String }
struct AtharLoginResponse: Decodable { let accessToken: String; let expiresAt: Date }
struct CompetitionAnswerRequest: Encodable { let choiceID: Int }
struct CompetitionRewardReceipt: Decodable { let id: String; let points: Int; let remainingPoints: Int }
extension LiveAmbassadorAPI {
    func configuration() async throws -> AtharConfiguration {
        try await client.send(path: "v1/config", method: .get)
    }
    func login(phone: String, password: String) async throws {
        let response: AtharLoginResponse = try await client.send(path: "v1/auth/login", method: .post, body: AtharLoginRequest(phone: phone, password: password))
        authTokenStore.token = response.accessToken
    }
    func logout() async throws {
        let _: EmptyResponse = try await client.send(path: "v1/auth/logout", method: .post, body: EmptyResponse())
    }
    func orders() async throws -> [RedemptionReceipt] {
        try await client.send(path: "v1/ambassador/store/orders", method: .get)
    }
    func competitions() async throws -> [RemoteCompetition] {
        try await client.send(path: "v1/competitions/upcoming", method: .get)
    }
    func snapshot(id: String) async throws -> RemoteCompetitionSnapshot {
        try await client.send(path: "v1/competitions/\(id)/snapshot", method: .get)
    }
    func join(id: String) async throws {
        let _: EmptyResponse = try await client.send(path: "v1/competitions/\(id)/join", method: .post, body: EmptyResponse())
    }
    func answer(competitionID: String, questionID: String, choice: Int) async throws {
        let _: EmptyResponse = try await client.send(path: "v1/competitions/\(competitionID)/questions/\(questionID)/answers", method: .post, body: CompetitionAnswerRequest(choiceID: choice))
    }
    func claimReward(id: String) async throws -> CompetitionRewardReceipt {
        try await client.send(path: "v1/competitions/\(id)/rewards/claim", method: .post, body: EmptyResponse())
    }
}
