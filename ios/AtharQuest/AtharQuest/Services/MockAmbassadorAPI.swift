import Foundation

actor MockAmbassadorAPI: AmbassadorAPI {
    func fetchDashboard() async throws -> DashboardPayload {
        try await Task.sleep(for: .milliseconds(420))
        return Self.dashboard
    }

    func createBox(_ request: CreateBoxRequest) async throws -> MemorialOpportunity {
        try await Task.sleep(for: .milliseconds(360))
        return MemorialOpportunity(
            id: UUID().uuidString,
            deceasedName: request.deceasedName,
            title: request.title,
            raised: 0,
            target: request.target,
            donors: 0,
            shareURL: URL(string: "https://donate.utq.org.sa/o/demo-\(UUID().uuidString.prefix(8))")!,
            state: .active,
            createdAt: .now
        )
    }

    func redeem(productID: String, shippingAddress: String) async throws -> RedemptionReceipt {
        try await Task.sleep(for: .milliseconds(400))
        guard let product = Self.products.first(where: { $0.id == productID }) else {
            throw APIError.server(status: 404, message: "المنتج غير موجود.")
        }
        return RedemptionReceipt(
            id: UUID().uuidString,
            productID: product.id,
            productName: product.name,
            pointsSpent: product.pointCost,
            remainingPoints: max(1_280 - product.pointCost, 0),
            statusText: product.requiresShipping ? "بانتظار تأكيد العنوان" : "جاهز للاستخدام"
        )
    }

    func claimMission(id: String) async throws -> AmbassadorMission {
        try await Task.sleep(for: .milliseconds(250))
        guard var mission = Self.missions.first(where: { $0.id == id }) else {
            throw APIError.server(status: 404, message: "المهمة غير موجودة.")
        }
        mission.state = .claimed
        return mission
    }

    func recordShare(resourceID: String?, destination: String) async throws {
        try await Task.sleep(for: .milliseconds(180))
    }

    func completeGame(_ payload: GameCompletionPayload) async throws {
        try await Task.sleep(for: .milliseconds(180))
    }

    static let products: [RewardProduct] = [
        RewardProduct(
            id: "thermal-mug",
            name: "كوب أثر الحراري",
            detail: "يحفظ الحرارة، مع تغليف خاص بالسفراء",
            pointCost: 450,
            stock: 18,
            symbolName: "mug.fill",
            tintHex: "176B57",
            requiresShipping: true
        ),
        RewardProduct(
            id: "book-bundle",
            name: "حقيبة كتب مختارة",
            detail: "ثلاثة كتب مع حقيبة قماشية",
            pointCost: 700,
            stock: 9,
            symbolName: "books.vertical.fill",
            tintHex: "6D5AA7",
            requiresShipping: true
        ),
        RewardProduct(
            id: "coffee-card",
            name: "بطاقة قهوة",
            detail: "قسيمة رقمية بقيمة 50 ريالًا",
            pointCost: 900,
            stock: 25,
            symbolName: "cup.and.saucer.fill",
            tintHex: "A66A45",
            requiresShipping: false
        ),
        RewardProduct(
            id: "ambassador-bag",
            name: "حقيبة السفير",
            detail: "حقيبة يومية خفيفة بشارة أثر",
            pointCost: 1_150,
            stock: 6,
            symbolName: "backpack.fill",
            tintHex: "D69A2D",
            requiresShipping: true
        )
    ]

    static let missions: [AmbassadorMission] = [
        AmbassadorMission(
            id: "daily-share",
            kind: .shareGeneralLink,
            title: "انشر رابط الكفالة",
            detail: "اختر شخصًا واحدًا قد تهمه كفالة طالب أو طالبة.",
            progress: 0,
            target: 1,
            seedReward: 20,
            rewardPointBonus: 0,
            state: .available,
            actionTitle: "مشاركة الرابط"
        ),
        AmbassadorMission(
            id: "weekly-puzzles",
            kind: .playPuzzle,
            title: "استعد لمسابقة الجمعة",
            detail: "أكمل جولتين تدريبيتين لتزيد سرعة تركيزك قبل البث.",
            progress: 1,
            target: 2,
            seedReward: 35,
            rewardPointBonus: 0,
            state: .inProgress,
            actionTitle: "دخول المسابقة"
        ),
        AmbassadorMission(
            id: "create-box",
            kind: .createMemorialBox,
            title: "أنشئ أثرًا باقيًا",
            detail: "أنشئ صندوقًا باسم متوفى ثم شاركه مع معارفك.",
            progress: 0,
            target: 1,
            seedReward: 50,
            rewardPointBonus: 15,
            state: .available,
            actionTitle: "إنشاء صندوق"
        ),
        AmbassadorMission(
            id: "first-donation",
            kind: .firstBoxDonation,
            title: "أول مساهمة للصندوق",
            detail: "تكتمل تلقائيًا عند وصول أول تبرع موثّق لصندوقك.",
            progress: 0,
            target: 1,
            seedReward: 80,
            rewardPointBonus: 30,
            state: .available,
            actionTitle: "عرض الصناديق"
        ),
        AmbassadorMission(
            id: "weekly-impact",
            kind: .weeklyImpact,
            title: "أثر الأسبوع",
            detail: "ساهم في وصول تبرعات موثّقة بقيمة 500 ريال.",
            progress: 340,
            target: 500,
            seedReward: 120,
            rewardPointBonus: 50,
            state: .inProgress,
            actionTitle: "شارك فرصة"
        )
    ]

    static let dashboard = DashboardPayload(
        profile: AmbassadorProfile(
            id: "demo-ambassador",
            name: "عبدالله",
            avatarInitials: "ع",
            rewardPoints: 1_280,
            gameSeeds: 185,
            level: 7,
            levelProgress: 0.64,
            playStyle: .calm,
            hapticsEnabled: true,
            soundEnabled: true
        ),
        impact: ImpactSummary(
            totalRaised: 8_430,
            donors: 37,
            successfulShares: 24,
            activeBoxes: 2,
            collectiveSeasonRaised: 184_200,
            collectiveSeasonTarget: 250_000
        ),
        missions: missions,
        boxes: [
            MemorialOpportunity(
                id: "box-1",
                deceasedName: "محمد بن صالح",
                title: "صدقة جارية عن محمد بن صالح",
                raised: 2_850,
                target: 5_000,
                donors: 19,
                shareURL: URL(string: "https://donate.utq.org.sa/o/mohammed")!,
                state: .active,
                createdAt: Calendar.current.date(byAdding: .day, value: -18, to: .now)!
            ),
            MemorialOpportunity(
                id: "box-2",
                deceasedName: "نورة بنت عبدالله",
                title: "وقف قرآني عن نورة بنت عبدالله",
                raised: 1_130,
                target: 3_000,
                donors: 11,
                shareURL: URL(string: "https://donate.utq.org.sa/o/noura")!,
                state: .active,
                createdAt: Calendar.current.date(byAdding: .day, value: -7, to: .now)!
            )
        ],
        products: products,
        gameProgress: GameProgress(
            unlockedLevel: 4,
            completedLevels: [1, 2, 3],
            bestStarsByLevel: [1: 3, 2: 2, 3: 3],
            oasisStage: 3,
            treesGrown: 8,
            totalPuzzlesSolved: 12
        ),
        generalShareURL: URL(string: "https://donate.utq.org.sa")!
    )
}
