import Foundation
import SwiftUI

struct SharePayload: Identifiable {
    let id = UUID()
    let url: URL
    let message: String
    let resourceID: String?
    let demoBonusPoints: Int
    let bonusKey: String?
}

@MainActor
final class AppModel: ObservableObject {
    @Published var profile: AmbassadorProfile?
    @Published var impact: ImpactSummary?
    @Published var missions: [AmbassadorMission] = []
    @Published var boxes: [MemorialOpportunity] = []
    @Published var products: [RewardProduct] = []
    @Published var gameProgress = GameProgress(
        unlockedLevel: 1,
        completedLevels: [],
        bestStarsByLevel: [:],
        oasisStage: 1,
        treesGrown: 1,
        totalPuzzlesSolved: 0
    )
    @Published var generalShareURL = URL(string: "https://donate.utq.org.sa")!

    @Published var selectedTab: AmbassadorTab = .home
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var toastMessage: String?
    @Published var sharePayload: SharePayload?
    @Published var redemptionReceipt: RedemptionReceipt?
    @Published var isRedeeming = false
    @Published var isCreatingBox = false
    @Published var hasCompletedOnboarding: Bool
    @Published private(set) var claimedCompetitionIDs: Set<String> = []
    @Published private(set) var claimedImpactBonusKeys: Set<String> = []

    @Published var configuration: AtharConfiguration?
    @Published var needsLogin = false
    @Published var orders: [RedemptionReceipt] = []
    @Published var isSigningIn = false
    private var claimingMissionIDs: Set<String> = []
    var liveAPI: LiveAmbassadorAPI? { api as? LiveAmbassadorAPI }

    let isDemoMode = AppEnvironment.usesDemoData

    private let api: any AmbassadorAPI
    private let store: PersistenceStore
    private var didBootstrap = false
    private var pendingBoxBonus: (key: String, points: Int)?

    init(
        api: (any AmbassadorAPI)? = nil,
        store: PersistenceStore = PersistenceStore()
    ) {
        self.api = api ?? AppEnvironment.makeAPI()
        self.store = store
        self.hasCompletedOnboarding = store.hasCompletedOnboarding
    }

    func bootstrap() async {
        guard !didBootstrap else { return }
        didBootstrap = true
        isLoading = true
        defer { isLoading = false }

        do {
            if let liveAPI {
                configuration = try await liveAPI.configuration()
                guard configuration?.enabled == true else { return }
                guard KeychainTokenStore().token != nil else { needsLogin = true; return }
                hasCompletedOnboarding = true
            }
            let payload = try await api.fetchDashboard()
            apply(payload)
            restoreLocalStateIfAvailable()
        } catch {
            errorMessage = error.localizedDescription
            restoreLocalStateIfAvailable()
        }
    }

    func login(phone: String, password: String) async {
        guard let liveAPI, !isSigningIn else { return }
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            try await liveAPI.login(phone: phone, password: password)
            needsLogin = false
            await retryBootstrap()
        } catch { errorMessage = "تعذّر الدخول. تحقق من رقم الجوال وكلمة المرور والاتصال." }
    }

    func clearSession() {
        KeychainTokenStore().token = nil
        profile = nil; impact = nil; missions = []; boxes = []; products = []; orders = []
        redemptionReceipt = nil; sharePayload = nil; errorMessage = nil
        gameProgress = GameProgress(unlockedLevel: 1, completedLevels: [], bestStarsByLevel: [:], oasisStage: 1, treesGrown: 1, totalPuzzlesSolved: 0)
        generalShareURL = URL(string: "https://donate.utq.org.sa")!
        claimedCompetitionIDs = []; claimedImpactBonusKeys = []; pendingBoxBonus = nil
        selectedTab = .home; needsLogin = true; didBootstrap = false
    }

    func logout() async {
        do { try await liveAPI?.logout(); clearSession() }
        catch { errorMessage = error.localizedDescription }
    }

    func refresh() async {
        do {
            if let liveAPI { configuration = try await liveAPI.configuration() }
            apply(try await api.fetchDashboard())
        } catch { errorMessage = error.localizedDescription }
    }

    func loadOrders() async {
        do { if let liveAPI { orders = try await liveAPI.orders() } }
        catch { errorMessage = error.localizedDescription }
    }

    func retryBootstrap() async {
        didBootstrap = false
        errorMessage = nil
        await bootstrap()
    }

    func finishOnboarding(name: String, playStyle: PlayStyle) {
        if var profile {
            let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
            if !cleanedName.isEmpty {
                profile.name = cleanedName
                profile.avatarInitials = String(cleanedName.prefix(1))
            }
            profile.playStyle = playStyle
            self.profile = profile
        }
        hasCompletedOnboarding = true
        store.hasCompletedOnboarding = true
        persist()
    }

    func setPlayStyle(_ playStyle: PlayStyle) {
        profile?.playStyle = playStyle
        persist()
    }

    func setHaptics(_ enabled: Bool) {
        profile?.hapticsEnabled = enabled
        persist()
    }

    func setSound(_ enabled: Bool) {
        profile?.soundEnabled = enabled
        persist()
    }

    func startShare(
        url: URL,
        message: String,
        resourceID: String? = nil,
        demoBonusPoints: Int = 0,
        bonusKey: String? = nil
    ) {
        AtharHaptics.tap(enabled: profile?.hapticsEnabled ?? true)
        sharePayload = SharePayload(
            url: url,
            message: message,
            resourceID: resourceID,
            demoBonusPoints: demoBonusPoints,
            bonusKey: bonusKey
        )
    }

    func completeShare(payload: SharePayload, didComplete: Bool, destination: String?) async {
        sharePayload = nil
        guard didComplete else { return }

        do {
            try await api.recordShare(
                resourceID: payload.resourceID,
                destination: destination ?? "ios-share-sheet"
            )

            if !isDemoMode {
                await refresh()
                toastMessage = "تم تسجيل المشاركة بنجاح"
                return
            }
            impact?.successfulShares += 1
            if payload.resourceID == nil {
                updateMission(kind: .shareGeneralLink, increment: 1)
            }

            if isDemoMode,
               payload.demoBonusPoints > 0,
               let bonusKey = payload.bonusKey,
               !claimedImpactBonusKeys.contains(bonusKey) {
                claimedImpactBonusKeys.insert(bonusKey)
                profile?.rewardPoints += payload.demoBonusPoints
                toastMessage = "+\(payload.demoBonusPoints) نقاط من جولة الأثر"
            } else if payload.demoBonusPoints > 0 {
                toastMessage = "تمت المشاركة، وتضاف النقاط بعد التحقق من الزيارة"
            } else {
                toastMessage = "تم تسجيل المشاركة بنجاح"
            }
            AtharHaptics.success(enabled: profile?.hapticsEnabled ?? true)
            persist()
        } catch {
            toastMessage = "تمت المشاركة، لكن تعذّر تسجيلها. أعد المحاولة عند عودة الاتصال."
        }
    }

    func goToMissionAction(_ mission: AmbassadorMission) {
        switch mission.kind {
        case .shareGeneralLink, .weeklyImpact:
            startShare(
                url: generalShareURL,
                message: "ساهم معنا في تعليم كتاب الله، وانشر الأثر لمن تحب."
            )
        case .createMemorialBox, .firstBoxDonation:
            selectedTab = .boxes
        case .playPuzzle:
            selectedTab = .game
        }
    }

    func claimMission(_ mission: AmbassadorMission) async {
        guard mission.state == .completed, !claimingMissionIDs.contains(mission.id) else { return }
        claimingMissionIDs.insert(mission.id)
        defer { claimingMissionIDs.remove(mission.id) }

        do {
            let updated = try await api.claimMission(id: mission.id)
            if !isDemoMode {
                await refresh()
                toastMessage = "تم استلام مكافأة المهمة"
                return
            }
            guard let index = missions.firstIndex(where: { $0.id == mission.id }) else { return }
            missions[index] = updated
            profile?.gameSeeds += mission.seedReward
            profile?.rewardPoints += mission.rewardPointBonus
            toastMessage = mission.rewardPointBonus > 0
                ? "+\(mission.seedReward) نقطة تدريب و +\(mission.rewardPointBonus) نقطة متجر"
                : "+\(mission.seedReward) نقطة تدريب"
            AtharHaptics.success(enabled: profile?.hapticsEnabled ?? true)
            persist()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createBox(name: String, title: String, target: Decimal) async -> Bool {
        guard !isCreatingBox else { return false }
        isCreatingBox = true
        defer { isCreatingBox = false }

        do {
            let request = CreateBoxRequest(deceasedName: name, title: title, target: target)
            let box = try await api.createBox(request)
            if !isDemoMode {
                await refresh()
                toastMessage = "تم إرسال طلب الصندوق للمراجعة"
                return true
            }
            boxes.insert(box, at: 0)
            impact?.activeBoxes += 1
            updateMission(kind: .createMemorialBox, increment: 1)

            if isDemoMode,
               let pendingBoxBonus,
               !claimedImpactBonusKeys.contains(pendingBoxBonus.key) {
                claimedImpactBonusKeys.insert(pendingBoxBonus.key)
                profile?.rewardPoints += pendingBoxBonus.points
                toastMessage = "أُنشئ الصندوق و+\(pendingBoxBonus.points) نقطة أثر"
                self.pendingBoxBonus = nil
            } else {
                toastMessage = "أُنشئ الصندوق، بقي أن تنشر رابطه"
            }
            AtharHaptics.success(enabled: profile?.hapticsEnabled ?? true)
            persist()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func redeem(_ product: RewardProduct, shippingAddress: String = "") async {
        guard !isRedeeming else { return }
        guard let profile, profile.rewardPoints >= product.pointCost, product.stock > 0 else {
            AtharHaptics.warning(enabled: self.profile?.hapticsEnabled ?? true)
            return
        }

        isRedeeming = true
        defer { isRedeeming = false }

        do {
            var receipt = try await api.redeem(productID: product.id, shippingAddress: shippingAddress)
            if isDemoMode {
                receipt.remainingPoints = profile.rewardPoints - product.pointCost
            }
            self.profile?.rewardPoints = receipt.remainingPoints
            redemptionReceipt = receipt
            if !isDemoMode { await refresh(); await loadOrders() }
            AtharHaptics.success(enabled: self.profile?.hapticsEnabled ?? true)
            persist()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func completeGame(level: Int, stars: Int, elapsedSeconds: Int) async {
        guard let profile else { return }
        if !isDemoMode {
            do {
                try await api.completeGame(GameCompletionPayload(level: level, stars: stars, elapsedSeconds: elapsedSeconds, playStyle: profile.playStyle))
                await refresh()
            } catch { errorMessage = "تعذّر تسجيل التدريب. أعد المحاولة عند عودة الاتصال." }
            return
        }
        let oldBest = gameProgress.bestStarsByLevel[level] ?? 0
        let isFirstCompletion = !gameProgress.completedLevels.contains(level)

        if isFirstCompletion {
            gameProgress.completedLevels.append(level)
            gameProgress.totalPuzzlesSolved += 1
            gameProgress.treesGrown += 1
            gameProgress.unlockedLevel = max(gameProgress.unlockedLevel, min(level + 1, 12))
            updateMission(kind: .playPuzzle, increment: 1)
        }

        if stars > oldBest {
            gameProgress.bestStarsByLevel[level] = stars
            self.profile?.gameSeeds += (stars - oldBest) * 12
        }

        gameProgress.oasisStage = min(1 + gameProgress.completedLevels.count / 3, 5)
        recalculateProfileLevel()
        persist()

        do {
            try await api.completeGame(
                GameCompletionPayload(
                    level: level,
                    stars: stars,
                    elapsedSeconds: elapsedSeconds,
                    playStyle: profile.playStyle
                )
            )
        } catch {
            toastMessage = "حُفظ الفوز على الجهاز، وسنزامنه عند عودة الاتصال"
        }
    }

    @discardableResult
    func claimCompetitionReward(competitionID: String, points: Int) -> Bool {
        guard points > 0, !claimedCompetitionIDs.contains(competitionID) else { return false }
        guard isDemoMode else {
            toastMessage = "يلزم ربط خادم المسابقة لاستلام النقاط الفعلية"
            return false
        }
        claimedCompetitionIDs.insert(competitionID)
        profile?.rewardPoints += points
        toastMessage = "أضيفت \(points.formatted()) نقطة إلى رصيدك"
        AtharHaptics.success(enabled: profile?.hapticsEnabled ?? true)
        persist()
        return true
    }

    func hasClaimedCompetition(_ competitionID: String) -> Bool {
        claimedCompetitionIDs.contains(competitionID)
    }

    func hasClaimedImpactBonus(_ key: String) -> Bool {
        claimedImpactBonusKeys.contains(key)
    }

    func prepareBoxBonus(key: String, points: Int) {
        guard !claimedImpactBonusKeys.contains(key) else { return }
        pendingBoxBonus = (key, points)
    }

    func resetDemo() {
        store.reset()
        profile = nil
        impact = nil
        missions = []
        boxes = []
        products = []
        claimedCompetitionIDs = []
        claimedImpactBonusKeys = []
        pendingBoxBonus = nil
        hasCompletedOnboarding = false
        didBootstrap = false
        selectedTab = .home
        Task { await bootstrap() }
    }

    func dismissToast() {
        toastMessage = nil
    }

    private func apply(_ payload: DashboardPayload) {
        profile = payload.profile
        impact = payload.impact
        missions = payload.missions
        boxes = payload.boxes
        products = payload.products
        gameProgress = payload.gameProgress
        generalShareURL = payload.generalShareURL
    }

    private func updateMission(kind: MissionKind, increment: Int) {
        guard let index = missions.firstIndex(where: {
            $0.kind == kind && $0.state != .claimed && $0.state != .completed
        }) else { return }

        missions[index].progress = min(missions[index].progress + increment, missions[index].target)
        missions[index].state = missions[index].progress >= missions[index].target
            ? .completed
            : .inProgress
    }

    private func recalculateProfileLevel() {
        let stars = gameProgress.bestStarsByLevel.values.reduce(0, +)
        let level = max(1, 1 + stars / 5)
        profile?.level = level
        profile?.levelProgress = Double(stars % 5) / 5
    }

    private func restoreLocalStateIfAvailable() {
        guard isDemoMode, let snapshot = store.loadSnapshot() else { return }
        profile = snapshot.profile
        missions = snapshot.missions
        boxes = snapshot.boxes
        gameProgress = snapshot.gameProgress
        claimedCompetitionIDs = snapshot.claimedCompetitionIDs ?? []
        claimedImpactBonusKeys = snapshot.claimedImpactBonusKeys ?? []
    }

    private func persist() {
        guard isDemoMode, let profile else { return }
        store.save(
            LocalSnapshot(
                profile: profile,
                missions: missions,
                boxes: boxes,
                gameProgress: gameProgress,
                claimedCompetitionIDs: claimedCompetitionIDs,
                claimedImpactBonusKeys: claimedImpactBonusKeys
            )
        )
    }
}
