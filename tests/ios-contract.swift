import Foundation

final class ContractURLProtocol: URLProtocol {
    static var requests: [URLRequest] = []
    static var status = 500
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
@main struct IOSContractCheck {
    static func main() async throws {
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let dashboard = try decoder.decode(DashboardPayload.self, from: Data(contentsOf: root.appendingPathComponent("dashboard.json")))
        precondition(dashboard.profile.rewardPoints == 2000)
        precondition(dashboard.boxes.first?.id == "fund-999")
        let question = try decoder.decode(RemoteCompetitionSnapshot.self, from: Data(contentsOf: root.appendingPathComponent("question.json")))
        precondition(question.question?.correctIndex == nil)
        let reveal = try decoder.decode(RemoteCompetitionSnapshot.self, from: Data(contentsOf: root.appendingPathComponent("reveal.json")))
        precondition(reveal.question?.correctIndex == 2)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ContractURLProtocol.self]
        let client = APIClient(baseURL: URL(string: "https://athar-contract.invalid")!, tokenStore: MemoryTokenStore(token: UUID().uuidString), session: URLSession(configuration: config))
        do {
            let _: EmptyResponse = try await client.send(path: "v1/test", method: .post, body: EmptyResponse())
            preconditionFailure("Expected server failure")
        } catch {}
        ContractURLProtocol.status = 200
        let _: EmptyResponse = try await client.send(path: "v1/test", method: .post, body: EmptyResponse())
        let _: EmptyResponse = try await client.send(path: "v1/test", method: .post, body: EmptyResponse())
        let keys = ContractURLProtocol.requests.map { $0.value(forHTTPHeaderField: "Idempotency-Key") }
        precondition(keys[0] != nil && keys[0] == keys[1] && keys[1] != keys[2])
        print("PASS Swift decodes real dashboard, question and reveal responses; retries reuse operation keys.")
    }
}
