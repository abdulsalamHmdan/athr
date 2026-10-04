import Foundation

enum AmbassadorTab: Int, CaseIterable, Hashable, Identifiable {
    case home
    case missions
    case game
    case boxes
    case store

    var id: Int { rawValue }
}

enum PlayStyle: String, Codable, CaseIterable, Hashable, Identifiable {
    case calm
    case challenge

    var id: String { rawValue }

    var title: String {
        switch self {
        case .calm: "هادئ"
        case .challenge: "تحدّي"
        }
    }

    var subtitle: String {
        switch self {
        case .calm: "بلا مؤقت، مع تلميحات واضحة"
        case .challenge: "وقت ونجوم ومراحل أسرع"
        }
    }
}

struct AmbassadorProfile: Codable, Equatable {
    var id: String
    var name: String
    var avatarInitials: String
    var rewardPoints: Int
    var gameSeeds: Int
    var level: Int
    var levelProgress: Double
    var playStyle: PlayStyle
    var hapticsEnabled: Bool
    var soundEnabled: Bool
}

struct ImpactSummary: Codable, Equatable {
    var totalRaised: Decimal
    var donors: Int
    var successfulShares: Int
    var activeBoxes: Int
    var collectiveSeasonRaised: Decimal
    var collectiveSeasonTarget: Decimal
}

enum MissionKind: String, Codable, Equatable {
    case shareGeneralLink
    case createMemorialBox
    case firstBoxDonation
    case weeklyImpact
    case playPuzzle
}

enum MissionState: String, Codable, Equatable {
    case available
    case inProgress
    case completed
    case claimed
}

struct AmbassadorMission: Identifiable, Codable, Equatable {
    var id: String
    var kind: MissionKind
    var title: String
    var detail: String
    var progress: Int
    var target: Int
    var seedReward: Int
    var rewardPointBonus: Int
    var state: MissionState
    var actionTitle: String

    var progressFraction: Double {
        guard target > 0 else { return 0 }
        return min(max(Double(progress) / Double(target), 0), 1)
    }
}

struct MemorialOpportunity: Identifiable, Codable, Equatable {
    var id: String
    var deceasedName: String
    var title: String
    var raised: Decimal
    var target: Decimal
    var donors: Int
    var shareURL: URL
    var state: OpportunityState
    var createdAt: Date

    var progressFraction: Double {
        let targetValue = NSDecimalNumber(decimal: target).doubleValue
        guard targetValue > 0 else { return 0 }
        return min(
            NSDecimalNumber(decimal: raised).doubleValue / targetValue,
            1
        )
    }

    var isShareable: Bool { state == .active && progressFraction < 1 }
}

enum OpportunityState: String, Codable, Equatable {
    case pendingReview
    case active
    case completed
    case paused

    var title: String {
        switch self {
        case .pendingReview: "بانتظار الاعتماد"
        case .active: "نشط"
        case .completed: "مكتمل"
        case .paused: "متوقف"
        }
    }
}

struct RewardProduct: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var detail: String
    var pointCost: Int
    var stock: Int
    var symbolName: String
    var tintHex: String
    var requiresShipping: Bool
}

struct GameProgress: Codable, Equatable {
    var unlockedLevel: Int
    var completedLevels: [Int]
    var bestStarsByLevel: [Int: Int]
    var oasisStage: Int
    var treesGrown: Int
    var totalPuzzlesSolved: Int
}

struct DashboardPayload: Codable, Equatable {
    var profile: AmbassadorProfile
    var impact: ImpactSummary
    var missions: [AmbassadorMission]
    var boxes: [MemorialOpportunity]
    var products: [RewardProduct]
    var gameProgress: GameProgress
    var generalShareURL: URL
}

struct CreateBoxRequest: Codable {
    var deceasedName: String
    var title: String
    var target: Decimal
}

struct RedemptionReceipt: Identifiable, Codable, Equatable {
    var id: String
    var productID: String
    var productName: String
    var pointsSpent: Int
    var remainingPoints: Int
    var statusText: String
}

struct LocalSnapshot: Codable {
    var profile: AmbassadorProfile
    var missions: [AmbassadorMission]
    var boxes: [MemorialOpportunity]
    var gameProgress: GameProgress
    var claimedCompetitionIDs: Set<String>?
    var claimedImpactBonusKeys: Set<String>?
}


struct AtharConfiguration: Decodable {
    var enabled: Bool
    var storeEnabled: Bool
    var boxesEnabled: Bool
    var competitionsEnabled: Bool
    var missionsEnabled: Bool
    var gameEnabled: Bool
    var maintenanceMessage: String
    var supportURL: String
    var privacyURL: String
    var termsURL: String
}
struct RemoteCompetition: Decodable, Identifiable {
    let id: String
    let title: String
    let scheduledAt: Date
    let rewardPool: Int
    let questionCount: Int
    let durationSeconds: Int
    let eligibilityPercent: Int
    let state: String
}
struct RemoteQuestion: Decodable, Identifiable {
    let id: String
    let index: Int
    let text: String
    let choices: [String]
    let closesAt: Date
    let answered: Bool
    let selectedChoice: Int?
    let correctIndex: Int?
    let explanation: String?
    let reference: String?
    let score: Int?
}
struct RemoteRank: Decodable, Identifiable {
    let id: String
    let name: String
    let score: Int
    let rank: Int
}
struct RemoteCompetitionSnapshot: Decodable {
    let id: String
    let title: String
    let state: String
    let serverTime: Date
    let joined: Bool
    let participantCount: Int
    let questionCount: Int
    let question: RemoteQuestion?
    let leaderboard: [RemoteRank]
    let rewardPoints: Int
    let rank: Int
    let claimed: Bool
}
