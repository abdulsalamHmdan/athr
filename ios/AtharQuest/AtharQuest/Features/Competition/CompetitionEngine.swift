import Combine
import Foundation

final class LiveCompetitionEngine: ObservableObject {
    @Published private(set) var phase: LiveCompetitionPhase = .lobby
    @Published private(set) var participants: [CompetitionParticipant]
    @Published private(set) var currentQuestionIndex = 0
    @Published private(set) var secondsRemaining: Double = 0
    @Published private(set) var selectedChoiceID: Int?
    @Published private(set) var answeredCount = 0
    @Published private(set) var answerResult: QuestionAnswerResult?
    @Published private(set) var biggestMovers: [CompetitionParticipant] = []
    @Published private(set) var fastestCorrectName: String?
    @Published private(set) var fastestCorrectSeconds: Double?
    @Published private(set) var rewardAllocations: [RewardAllocation] = []
    @Published private(set) var totalDistributed = 0

    let definition: CompetitionDefinition

    private var questionStartedAt: Date?
    private var botPlans: [BotAnswerPlan] = []
    private var pendingUserAnswer: PendingUserAnswer?

    init(definition: CompetitionDefinition, userName: String, participantCount: Int = 30) {
        self.definition = definition
        self.participants = Self.makeParticipants(
            userName: userName,
            count: max(participantCount, 10)
        )
        self.secondsRemaining = definition.questions.first?.durationSeconds ?? 12
    }

    var currentQuestion: QuranQuizQuestion {
        definition.questions[currentQuestionIndex]
    }

    var questionNumber: Int { currentQuestionIndex + 1 }
    var questionCount: Int { definition.questions.count }
    var questionProgress: Double { Double(questionNumber) / Double(max(questionCount, 1)) }

    var currentUser: CompetitionParticipant? {
        participants.first(where: { $0.isCurrentUser })
    }

    var userAllocation: RewardAllocation? {
        rewardAllocations.first(where: { allocation in
            participants.first(where: { $0.id == allocation.participantID })?.isCurrentUser == true
        })
    }

    var topParticipants: [CompetitionParticipant] {
        participants.sorted(by: Self.competitionOrder).prefix(5).map { $0 }
    }

    var podium: [CompetitionParticipant] {
        participants.sorted(by: Self.competitionOrder).prefix(3).map { $0 }
    }

    var streakLeader: CompetitionParticipant? {
        participants.max {
            if $0.longestStreak == $1.longestStreak { return $0.score < $1.score }
            return $0.longestStreak < $1.longestStreak
        }
    }

    func start() {
        guard phase == .lobby, !definition.questions.isEmpty else { return }
        beginQuestion(at: .now)
    }

    func submitAnswer(choiceID: Int, at date: Date = .now) {
        guard phase == .question,
              selectedChoiceID == nil,
              let startedAt = questionStartedAt else { return }

        let responseSeconds = min(max(date.timeIntervalSince(startedAt), 0), currentQuestion.durationSeconds)
        guard responseSeconds < currentQuestion.durationSeconds else { return }
        let wasCorrect = choiceID == currentQuestion.correctChoiceID
        let user = currentUser
        let earned = Self.scoreForAnswer(
            wasCorrect: wasCorrect,
            responseSeconds: responseSeconds,
            durationSeconds: currentQuestion.durationSeconds
        )

        selectedChoiceID = choiceID
        pendingUserAnswer = PendingUserAnswer(
            choiceID: choiceID,
            wasCorrect: wasCorrect,
            score: earned,
            responseSeconds: responseSeconds,
            oldRank: user?.rank ?? participants.count
        )
        updateAnsweredCount(at: date)
    }

    func tick(at date: Date = .now) {
        guard phase == .question, let startedAt = questionStartedAt else { return }
        let elapsed = max(date.timeIntervalSince(startedAt), 0)
        secondsRemaining = max(currentQuestion.durationSeconds - elapsed, 0)
        updateAnsweredCount(at: date)

        if secondsRemaining <= 0 || answeredCount >= participants.count {
            finishQuestion()
        }
    }

    func showLeaderboard() {
        guard phase == .reveal else { return }
        phase = .leaderboard
    }

    func advance() {
        guard phase == .leaderboard else { return }
        if currentQuestionIndex >= definition.questions.count - 1 {
            finishCompetition()
        } else {
            currentQuestionIndex += 1
            beginQuestion(at: .now)
        }
    }

    func restartDemo() {
        let name = currentUser?.name ?? "سفير الأثر"
        participants = Self.makeParticipants(userName: name, count: participants.count)
        currentQuestionIndex = 0
        secondsRemaining = definition.questions.first?.durationSeconds ?? 12
        selectedChoiceID = nil
        answeredCount = 0
        answerResult = nil
        biggestMovers = []
        fastestCorrectName = nil
        fastestCorrectSeconds = nil
        rewardAllocations = []
        totalDistributed = 0
        questionStartedAt = nil
        botPlans = []
        pendingUserAnswer = nil
        phase = .lobby
    }

    static func scoreForAnswer(
        wasCorrect: Bool,
        responseSeconds: Double,
        durationSeconds: Double
    ) -> Int {
        guard wasCorrect, durationSeconds > 0 else { return 0 }
        let remainingRatio = min(max((durationSeconds - responseSeconds) / durationSeconds, 0), 1)
        return 500 + Int((500 * remainingRatio).rounded())
    }

    private func beginQuestion(at date: Date) {
        selectedChoiceID = nil
        pendingUserAnswer = nil
        answerResult = nil
        answeredCount = 0
        biggestMovers = []
        fastestCorrectName = nil
        fastestCorrectSeconds = nil
        secondsRemaining = currentQuestion.durationSeconds
        questionStartedAt = date
        botPlans = makeBotPlans(for: currentQuestionIndex)
        phase = .question
    }

    private func updateAnsweredCount(at date: Date) {
        guard let startedAt = questionStartedAt else { return }
        let elapsed = date.timeIntervalSince(startedAt)
        let botCount = botPlans.filter { $0.responseSeconds <= elapsed }.count
        answeredCount = min(botCount + (selectedChoiceID == nil ? 0 : 1), participants.count)
    }

    private func finishQuestion() {
        guard phase == .question else { return }

        for index in participants.indices {
            participants[index].previousRank = participants[index].rank
        }

        var fastest: (name: String, seconds: Double)?

        for plan in botPlans {
            guard let index = participants.firstIndex(where: { $0.id == plan.participantID }) else { continue }
            participants[index].answeredQuestions += 1

            if plan.wasCorrect {
                let points = Self.scoreForAnswer(
                    wasCorrect: true,
                    responseSeconds: plan.responseSeconds,
                    durationSeconds: currentQuestion.durationSeconds
                )
                participants[index].score += points
                participants[index].correctAnswers += 1
                participants[index].streak += 1
                participants[index].longestStreak = max(
                    participants[index].longestStreak,
                    participants[index].streak
                )

                if fastest.map({ plan.responseSeconds < $0.seconds }) ?? true {
                    fastest = (participants[index].name, plan.responseSeconds)
                }
            } else {
                participants[index].streak = 0
            }
        }

        if let userIndex = participants.firstIndex(where: { $0.isCurrentUser }) {
            if let pendingUserAnswer {
                participants[userIndex].answeredQuestions += 1
                participants[userIndex].score += pendingUserAnswer.score
                if pendingUserAnswer.wasCorrect {
                    participants[userIndex].correctAnswers += 1
                    participants[userIndex].streak += 1
                    participants[userIndex].longestStreak = max(
                        participants[userIndex].longestStreak,
                        participants[userIndex].streak
                    )
                    if fastest.map({ pendingUserAnswer.responseSeconds < $0.seconds }) ?? true {
                        fastest = (participants[userIndex].name, pendingUserAnswer.responseSeconds)
                    }
                } else {
                    participants[userIndex].streak = 0
                }
            } else {
                participants[userIndex].streak = 0
            }
        }

        updateRanks()

        if let pendingUserAnswer, let user = currentUser {
            answerResult = QuestionAnswerResult(
                selectedChoiceID: pendingUserAnswer.choiceID,
                correctChoiceID: currentQuestion.correctChoiceID,
                wasCorrect: pendingUserAnswer.wasCorrect,
                scoreEarned: pendingUserAnswer.score,
                responseSeconds: pendingUserAnswer.responseSeconds,
                oldRank: pendingUserAnswer.oldRank,
                newRank: user.rank
            )
        } else if let user = currentUser {
            answerResult = QuestionAnswerResult(
                selectedChoiceID: nil,
                correctChoiceID: currentQuestion.correctChoiceID,
                wasCorrect: false,
                scoreEarned: 0,
                responseSeconds: nil,
                oldRank: user.previousRank,
                newRank: user.rank
            )
        }

        biggestMovers = participants
            .filter { $0.rankMovement > 0 }
            .sorted {
                if $0.rankMovement == $1.rankMovement { return $0.score > $1.score }
                return $0.rankMovement > $1.rankMovement
            }
            .prefix(3)
            .map { $0 }

        fastestCorrectName = fastest?.name
        fastestCorrectSeconds = fastest?.seconds
        answeredCount = participants.count
        secondsRemaining = 0
        phase = .reveal
    }

    private func updateRanks() {
        let sortedIDs = participants.sorted(by: Self.competitionOrder).map(\.id)
        for (offset, id) in sortedIDs.enumerated() {
            guard let index = participants.firstIndex(where: { $0.id == id }) else { continue }
            participants[index].rank = offset + 1
        }
    }

    private func finishCompetition() {
        let minimumAnswered = Int(ceil(Double(definition.questions.count) * 0.7))
        rewardAllocations = RewardPoolAllocator.allocate(
            pool: definition.rewardPool,
            participants: participants,
            minimumAnsweredQuestions: minimumAnswered
        )
        totalDistributed = rewardAllocations.reduce(0) { $0 + $1.rewardPoints }

        for allocation in rewardAllocations {
            guard let index = participants.firstIndex(where: { $0.id == allocation.participantID }) else {
                continue
            }
            participants[index].rewardPoints = allocation.rewardPoints
        }
        phase = .final
    }

    private func makeBotPlans(for questionIndex: Int) -> [BotAnswerPlan] {
        participants
            .filter { !$0.isCurrentUser }
            .enumerated()
            .map { offset, participant in
                let accuracyThreshold = min(54 + (offset % 7) * 5, 86)
                let correctnessSeed = (offset * 37 + questionIndex * 19 + 11) % 100
                let wasCorrect = correctnessSeed < accuracyThreshold
                let timingSeed = (offset * 29 + questionIndex * 17 + 7) % 88
                let response = min(1.1 + Double(timingSeed) / 10, currentQuestion.durationSeconds - 0.4)
                let wrongOffset = ((offset + questionIndex) % 3) + 1
                let choice = wasCorrect
                    ? currentQuestion.correctChoiceID
                    : (currentQuestion.correctChoiceID + wrongOffset) % 4

                return BotAnswerPlan(
                    participantID: participant.id,
                    choiceID: choice,
                    wasCorrect: wasCorrect,
                    responseSeconds: response
                )
            }
    }

    private static func competitionOrder(
        _ first: CompetitionParticipant,
        _ second: CompetitionParticipant
    ) -> Bool {
        if first.score == second.score {
            if first.correctAnswers == second.correctAnswers {
                return first.name < second.name
            }
            return first.correctAnswers > second.correctAnswers
        }
        return first.score > second.score
    }

    private static func makeParticipants(userName: String, count: Int) -> [CompetitionParticipant] {
        let names = [
            "نورة", "خالد", "ريم", "عبدالرحمن", "سارة", "محمد", "الجوهرة", "فيصل",
            "ليان", "سلطان", "هيا", "تركي", "جود", "عبدالعزيز", "شهد", "راكان",
            "مها", "صالح", "غادة", "وليد", "أروى", "ماجد", "لمى", "بندر",
            "دانة", "إبراهيم", "العنود", "يوسف", "رغد", "سعد", "تالا", "عمر",
            "مريم", "ناصر", "لينا", "زياد", "أمل", "حسن", "شوق", "مشاعل"
        ]

        var result: [CompetitionParticipant] = [
            CompetitionParticipant(
                id: "current-user",
                name: userName,
                initials: String(userName.prefix(1)),
                isCurrentUser: true,
                score: 0,
                rank: max(count / 2, 1),
                previousRank: max(count / 2, 1),
                correctAnswers: 0,
                answeredQuestions: 0,
                streak: 0,
                longestStreak: 0,
                rewardPoints: 0
            )
        ]

        for index in 0..<(count - 1) {
            let name = names[index % names.count]
            result.append(
                CompetitionParticipant(
                    id: "bot-\(index)",
                    name: index >= names.count ? "\(name) \(index / names.count + 1)" : name,
                    initials: String(name.prefix(1)),
                    isCurrentUser: false,
                    score: 0,
                    rank: index < max(count / 2 - 1, 0) ? index + 1 : index + 2,
                    previousRank: index < max(count / 2 - 1, 0) ? index + 1 : index + 2,
                    correctAnswers: 0,
                    answeredQuestions: 0,
                    streak: 0,
                    longestStreak: 0,
                    rewardPoints: 0
                )
            )
        }
        return result
    }
}

private struct BotAnswerPlan {
    let participantID: String
    let choiceID: Int
    let wasCorrect: Bool
    let responseSeconds: Double
}

private struct PendingUserAnswer {
    let choiceID: Int
    let wasCorrect: Bool
    let score: Int
    let responseSeconds: Double
    let oldRank: Int
}
