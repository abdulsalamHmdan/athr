import Combine
import Foundation
import SwiftUI

struct LiveCompetitionView: View {
    @EnvironmentObject private var model: AppModel
    @StateObject private var engine: LiveCompetitionEngine

    private let timer = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    init(definition: CompetitionDefinition, userName: String) {
        _engine = StateObject(
            wrappedValue: LiveCompetitionEngine(
                definition: definition,
                userName: userName
            )
        )
    }

    var body: some View {
        ZStack {
            competitionBackground.ignoresSafeArea()

            switch engine.phase {
            case .lobby:
                CompetitionLobbyView(engine: engine)
            case .question:
                LiveQuestionView(engine: engine)
            case .reveal:
                QuestionRevealView(engine: engine)
            case .leaderboard:
                LiveLeaderboardView(engine: engine)
            case .final:
                CompetitionFinalView(engine: engine)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(engine.definition.title)
        .onReceive(timer) { date in engine.tick(at: date) }
        .animation(.easeInOut(duration: 0.24), value: engine.phase)
    }

    private var competitionBackground: some View {
        LinearGradient(
            colors: [Color(hex: "F5F1FF"), AtharTheme.pageBackground],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

private struct CompetitionLobbyView: View {
    @ObservedObject var engine: LiveCompetitionEngine

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 10) {
                    Label("الصالة مفتوحة", systemImage: "dot.radiowaves.left.and.right")
                        .font(.athar(13, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.red)
                        .clipShape(Capsule())

                    Image(systemName: "trophy.fill")
                        .font(.system(size: 62, weight: .bold))
                        .foregroundStyle(AtharTheme.gold)
                        .padding(.top, 10)

                    Text(engine.definition.title)
                        .font(.athar(29, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                        .multilineTextAlignment(.center)

                    Text("هذه محاكاة كاملة للمسابقة المباشرة مع متنافسين افتراضيين")
                        .font(.athar(14))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .multilineTextAlignment(.center)
                }

                HStack(spacing: 12) {
                    lobbyStat(
                        value: engine.participants.count.formatted(),
                        label: "مشاركًا",
                        symbol: "person.3.fill",
                        tint: Color(hex: "5A3FA0")
                    )
                    lobbyStat(
                        value: engine.definition.rewardPool.formatted(),
                        label: "نقطة بالحوض",
                        symbol: "seal.fill",
                        tint: AtharTheme.gold
                    )
                }

                participantCloud

                VStack(alignment: .leading, spacing: 12) {
                    ruleRow("تجيب خلال ١٢ ثانية", symbol: "timer")
                    ruleRow("الصحيحة الأسرع تحصل على درجة أعلى", symbol: "bolt.fill")
                    ruleRow("الخطأ أو انتهاء الوقت يساوي صفرًا", symbol: "xmark.circle.fill")
                    ruleRow("الإجمالي ٥٠٬٠٠٠ نقطة يُوزع نسبيًا", symbol: "percent")
                }
                .atharCard()

                Button {
                    engine.start()
                } label: {
                    Label("ابدأ المسابقة", systemImage: "play.fill")
                }
                .buttonStyle(PrimaryButtonStyle(tint: Color(hex: "5A3FA0")))
            }
            .padding(20)
        }
    }

    private var participantCloud: some View {
        VStack(spacing: 10) {
            HStack(spacing: -8) {
                ForEach(engine.participants.prefix(9)) { participant in
                    Text(participant.initials)
                        .font(.athar(14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .background(participant.isCurrentUser ? AtharTheme.gold : Color(hex: "5A3FA0"))
                        .clipShape(Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                }
            }
            Text("دخل الجميع… ننتظر إشارة البداية")
                .font(.athar(13, weight: .semibold))
                .foregroundStyle(AtharTheme.secondaryText)
        }
    }

    private func lobbyStat(value: String, label: String, symbol: String, tint: Color) -> some View {
        VStack(spacing: 7) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(tint)
            Text(value)
                .font(.athar(22, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
            Text(label)
                .font(.athar(11, weight: .medium))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .atharCard(padding: 14)
    }

    private func ruleRow(_ text: String, symbol: String) -> some View {
        HStack(spacing: 11) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color(hex: "5A3FA0"))
                .frame(width: 30, height: 30)
                .background(Color(hex: "5A3FA0").opacity(0.1))
                .clipShape(Circle())
            Text(text)
                .font(.athar(14, weight: .semibold))
                .foregroundStyle(AtharTheme.ink)
            Spacer()
        }
    }
}

private struct LiveQuestionView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var engine: LiveCompetitionEngine

    private let colors = [
        Color(hex: "D94C66"),
        Color(hex: "3E73C7"),
        Color(hex: "D79524"),
        Color(hex: "258A68")
    ]
    private let symbols = ["triangle.fill", "diamond.fill", "circle.fill", "square.fill"]

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                questionHeader
                timerBar

                Text(engine.currentQuestion.prompt)
                    .font(.athar(25, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
                    .frame(maxWidth: .infinity, minHeight: 112)
                    .atharCard()

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 11) {
                    ForEach(engine.currentQuestion.choices) { choice in
                        choiceButton(choice)
                    }
                }

                if engine.selectedChoiceID != nil {
                    HStack(spacing: 10) {
                        ProgressView()
                            .tint(Color(hex: "5A3FA0"))
                        Text("سُجلت إجابتك… ننتظر بقية المتسابقين")
                            .font(.athar(14, weight: .semibold))
                            .foregroundStyle(AtharTheme.secondaryText)
                    }
                    .padding(.top, 4)
                }

                if let user = engine.currentUser {
                    HStack {
                        Label("المركز \(user.rank)", systemImage: "chart.bar.fill")
                        Spacer()
                        Label(user.score.formatted(), systemImage: "bolt.fill")
                    }
                    .font(.athar(13, weight: .bold))
                    .foregroundStyle(Color(hex: "5A3FA0"))
                    .atharCard(padding: 13, background: Color(hex: "F0EBFF"))
                }
            }
            .padding(16)
        }
    }

    private var questionHeader: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text("السؤال \(engine.questionNumber) من \(engine.questionCount)")
                    .font(.athar(15, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                AtharProgressBar(
                    value: engine.questionProgress,
                    tint: Color(hex: "5A3FA0"),
                    height: 7
                )
                .frame(width: 130)
            }
            Spacer()
            Label("\(engine.answeredCount)/\(engine.participants.count)", systemImage: "person.2.fill")
                .font(.athar(12, weight: .bold))
                .foregroundStyle(AtharTheme.secondaryText)
        }
    }

    private var timerBar: some View {
        VStack(spacing: 7) {
            HStack {
                Label("الوقت", systemImage: "timer")
                    .font(.athar(13, weight: .bold))
                Spacer()
                Text("\(Int(ceil(engine.secondsRemaining)))")
                    .font(.athar(24, weight: .bold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
            }
            .foregroundStyle(engine.secondsRemaining <= 4 ? AtharTheme.coral : Color(hex: "5A3FA0"))

            ProgressView(
                value: engine.secondsRemaining,
                total: engine.currentQuestion.durationSeconds
            )
            .tint(engine.secondsRemaining <= 4 ? AtharTheme.coral : Color(hex: "5A3FA0"))
            .scaleEffect(x: 1, y: 1.8)
        }
        .padding(.horizontal, 3)
    }

    private func choiceButton(_ choice: QuizChoice) -> some View {
        let color = colors[choice.id % colors.count]
        let isSelected = engine.selectedChoiceID == choice.id

        return Button {
            AtharHaptics.tap(enabled: model.profile?.hapticsEnabled ?? true)
            GameAudio.playPipeTap(enabled: model.profile?.soundEnabled ?? true)
            engine.submitAnswer(choiceID: choice.id)
        } label: {
            VStack(spacing: 11) {
                Image(systemName: symbols[choice.id % symbols.count])
                    .font(.system(size: 19, weight: .bold))
                Text(choice.text)
                    .font(.athar(17, weight: .bold))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 108)
            .padding(10)
            .background(color.opacity(engine.selectedChoiceID == nil || isSelected ? 1 : 0.38))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(.white, lineWidth: 4)
                }
            }
            .scaleEffect(isSelected ? 0.97 : 1)
        }
        .buttonStyle(.plain)
        .disabled(engine.selectedChoiceID != nil)
        .accessibilityLabel(choice.text)
    }
}

private struct QuestionRevealView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var engine: LiveCompetitionEngine

    var body: some View {
        ScrollView {
            VStack(spacing: 17) {
                if let result = engine.answerResult {
                    resultHero(result)
                    answerExplanation
                    movementCard(result)
                    liveHighlights

                    Button {
                        engine.showLeaderboard()
                    } label: {
                        Label("عرض الترتيب", systemImage: "list.number")
                    }
                    .buttonStyle(PrimaryButtonStyle(tint: Color(hex: "5A3FA0")))
                }
            }
            .padding(18)
        }
        .onAppear {
            guard engine.answerResult?.wasCorrect == true else {
                AtharHaptics.warning(enabled: model.profile?.hapticsEnabled ?? true)
                return
            }
            AtharHaptics.success(enabled: model.profile?.hapticsEnabled ?? true)
            GameAudio.playSuccess(enabled: model.profile?.soundEnabled ?? true)
        }
    }

    private func resultHero(_ result: QuestionAnswerResult) -> some View {
        VStack(spacing: 10) {
            Image(systemName: result.wasCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 64, weight: .bold))
            Text(result.wasCorrect ? "إجابة صحيحة!" : (result.selectedChoiceID == nil ? "انتهى الوقت" : "إجابة غير صحيحة"))
                .font(.athar(28, weight: .bold))
            if result.wasCorrect {
                Text("+\(result.scoreEarned.formatted()) درجة")
                    .font(.athar(20, weight: .bold))
            }
            if let response = result.responseSeconds {
                Text("أجبت خلال \(response.formatted(.number.precision(.fractionLength(1)))) ثانية")
                    .font(.athar(13, weight: .medium))
                    .opacity(0.8)
            }
        }
        .foregroundStyle(result.wasCorrect ? AtharTheme.emerald : AtharTheme.coral)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
    }

    private var answerExplanation: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(AtharTheme.emerald)
                Text("الإجابة: \(engine.currentQuestion.correctChoice?.text ?? "—")")
                    .font(.athar(17, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
            }
            Text(engine.currentQuestion.explanation)
                .font(.athar(14))
                .foregroundStyle(AtharTheme.secondaryText)
                .lineSpacing(4)
            Label(engine.currentQuestion.reference, systemImage: "book.closed.fill")
                .font(.athar(12, weight: .semibold))
                .foregroundStyle(Color(hex: "5A3FA0"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .atharCard(background: AtharTheme.paleMint)
    }

    private func movementCard(_ result: QuestionAnswerResult) -> some View {
        HStack(spacing: 14) {
            Image(systemName: result.rankMovement > 0 ? "arrow.up.circle.fill" : "chart.bar.fill")
                .font(.system(size: 29, weight: .bold))
                .foregroundStyle(result.rankMovement > 0 ? AtharTheme.emerald : Color(hex: "5A3FA0"))
            VStack(alignment: .leading, spacing: 3) {
                Text("مركزك الآن: \(result.newRank)")
                    .font(.athar(19, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text(movementText(result.rankMovement))
                    .font(.athar(13, weight: .semibold))
                    .foregroundStyle(AtharTheme.secondaryText)
            }
            Spacer()
        }
        .atharCard()
    }

    private var liveHighlights: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("لحظات السؤال")
                .font(.athar(18, weight: .bold))
                .foregroundStyle(AtharTheme.ink)

            if let name = engine.fastestCorrectName, let seconds = engine.fastestCorrectSeconds {
                highlightRow(
                    symbol: "bolt.fill",
                    title: "أسرع إجابة: \(name)",
                    detail: "خلال \(seconds.formatted(.number.precision(.fractionLength(1)))) ثانية",
                    tint: AtharTheme.gold
                )
            }

            if let mover = engine.biggestMovers.first {
                highlightRow(
                    symbol: "arrow.up.right",
                    title: "أقوى صعود: \(mover.name)",
                    detail: "تقدم \(mover.rankMovement) مراكز",
                    tint: AtharTheme.emerald
                )
            }

            if let streak = engine.streakLeader, streak.longestStreak >= 2 {
                highlightRow(
                    symbol: "flame.fill",
                    title: "سلسلة \(streak.name)",
                    detail: "\(streak.longestStreak) إجابات صحيحة متتالية",
                    tint: AtharTheme.coral
                )
            }
        }
        .atharCard()
    }

    private func highlightRow(symbol: String, title: String, detail: String, tint: Color) -> some View {
        HStack(spacing: 11) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
                .frame(width: 36, height: 36)
                .background(tint.opacity(0.11))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.athar(14, weight: .bold))
                Text(detail).font(.athar(11)).foregroundStyle(AtharTheme.secondaryText)
            }
            Spacer()
        }
    }

    private func movementText(_ movement: Int) -> String {
        if movement > 0 { return "تقدمت \(movement) مراكز بقوة" }
        if movement < 0 { return "تراجعت \(abs(movement)) مراكز" }
        return "حافظت على مركزك"
    }
}

private struct LiveLeaderboardView: View {
    @ObservedObject var engine: LiveCompetitionEngine

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 6) {
                    Image(systemName: "list.number")
                        .font(.system(size: 38, weight: .bold))
                        .foregroundStyle(Color(hex: "5A3FA0"))
                    Text("الترتيب المباشر")
                        .font(.athar(28, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text("بعد السؤال \(engine.questionNumber) من \(engine.questionCount)")
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                }

                VStack(spacing: 8) {
                    ForEach(engine.topParticipants) { participant in
                        LeaderboardRow(participant: participant)
                    }

                    if let user = engine.currentUser,
                       !engine.topParticipants.contains(where: { $0.id == user.id }) {
                        HStack {
                            Capsule()
                                .fill(AtharTheme.divider)
                                .frame(height: 1)
                            Text("مركزك")
                                .font(.athar(11, weight: .bold))
                                .foregroundStyle(AtharTheme.secondaryText)
                            Capsule()
                                .fill(AtharTheme.divider)
                                .frame(height: 1)
                        }
                        .padding(.vertical, 3)
                        LeaderboardRow(participant: user)
                    }
                }

                if let mover = engine.biggestMovers.first {
                    Label(
                        "\(mover.name) أقوى صعودًا: +\(mover.rankMovement) مراكز",
                        systemImage: "arrow.up.right.circle.fill"
                    )
                    .font(.athar(14, weight: .bold))
                    .foregroundStyle(AtharTheme.emerald)
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(AtharTheme.mint)
                    .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                }

                Button {
                    engine.advance()
                } label: {
                    Label(
                        engine.questionNumber == engine.questionCount ? "عرض النتائج النهائية" : "السؤال التالي",
                        systemImage: engine.questionNumber == engine.questionCount ? "trophy.fill" : "arrow.left"
                    )
                }
                .buttonStyle(PrimaryButtonStyle(tint: Color(hex: "5A3FA0")))
            }
            .padding(18)
        }
    }
}

private struct LeaderboardRow: View {
    let participant: CompetitionParticipant

    var body: some View {
        HStack(spacing: 12) {
            Text("\(participant.rank)")
                .font(.athar(18, weight: .bold))
                .foregroundStyle(participant.rank <= 3 ? AtharTheme.gold : AtharTheme.secondaryText)
                .frame(width: 28)

            Text(participant.initials)
                .font(.athar(14, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 40, height: 40)
                .background(participant.isCurrentUser ? AtharTheme.gold : Color(hex: "5A3FA0"))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(participant.isCurrentUser ? "أنت — \(participant.name)" : participant.name)
                    .font(.athar(15, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("\(participant.correctAnswers) صحيحة • سلسلة \(participant.streak)")
                    .font(.athar(10, weight: .medium))
                    .foregroundStyle(AtharTheme.secondaryText)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(participant.score.formatted())
                    .font(.athar(16, weight: .bold))
                    .foregroundStyle(Color(hex: "5A3FA0"))
                if participant.rankMovement != 0 {
                    Label(
                        "\(abs(participant.rankMovement))",
                        systemImage: participant.rankMovement > 0 ? "arrow.up" : "arrow.down"
                    )
                    .font(.athar(9, weight: .bold))
                    .foregroundStyle(participant.rankMovement > 0 ? AtharTheme.emerald : AtharTheme.coral)
                }
            }
        }
        .padding(12)
        .background(participant.isCurrentUser ? AtharTheme.sand.opacity(0.24) : .white)
        .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .stroke(participant.isCurrentUser ? AtharTheme.gold : AtharTheme.divider, lineWidth: 1)
        }
    }
}

private struct CompetitionFinalView: View {
    @EnvironmentObject private var model: AppModel
    @ObservedObject var engine: LiveCompetitionEngine

    private var didClaim: Bool {
        model.hasClaimedCompetition(engine.definition.id)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundStyle(AtharTheme.gold)
                    Text("النتائج النهائية")
                        .font(.athar(29, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text("تم توزيع حوض المسابقة نسبيًا حسب درجات الأداء")
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                }

                podiumView

                if let user = engine.currentUser {
                    userResult(user)
                }

                poolAuditCard

                if let allocation = engine.userAllocation {
                    Button {
                        _ = model.claimCompetitionReward(
                            competitionID: engine.definition.id,
                            points: allocation.rewardPoints
                        )
                    } label: {
                        Label(
                            didClaim ? "تم استلام \(allocation.rewardPoints.formatted()) نقطة" : "استلام \(allocation.rewardPoints.formatted()) نقطة",
                            systemImage: didClaim ? "checkmark.seal.fill" : "seal.fill"
                        )
                    }
                    .buttonStyle(PrimaryButtonStyle(tint: didClaim ? AtharTheme.emerald : Color(hex: "5A3FA0")))
                    .disabled(didClaim)
                } else {
                    Text("يلزم إكمال ٧٠٪ من الأسئلة وتحقيق درجة صحيحة للتأهل لتوزيع الحوض.")
                        .font(.athar(14, weight: .semibold))
                        .foregroundStyle(AtharTheme.coral)
                        .multilineTextAlignment(.center)
                        .atharCard(background: AtharTheme.coral.opacity(0.08))
                }

                ImpactRoundView(competition: engine.definition)

                Button("إعادة التجربة") {
                    engine.restartDemo()
                }
                .font(.athar(14, weight: .bold))
                .foregroundStyle(AtharTheme.secondaryText)
            }
            .padding(18)
        }
    }

    private var podiumView: some View {
        let podium = engine.podium
        let ordered: [CompetitionParticipant] = podium.count == 3
            ? [podium[1], podium[0], podium[2]]
            : podium

        return HStack(alignment: .bottom, spacing: 8) {
            ForEach(ordered) { participant in
                let isWinner = participant.rank == 1
                VStack(spacing: 8) {
                    if isWinner {
                        Image(systemName: "crown.fill")
                            .foregroundStyle(AtharTheme.gold)
                    }
                    Text(participant.initials)
                        .font(.athar(isWinner ? 22 : 17, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: isWinner ? 62 : 50, height: isWinner ? 62 : 50)
                        .background(isWinner ? AtharTheme.gold : Color(hex: "5A3FA0"))
                        .clipShape(Circle())
                    Text(participant.name)
                        .font(.athar(12, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                        .lineLimit(1)
                    Text("\(participant.rewardPoints.formatted()) نقطة")
                        .font(.athar(10, weight: .bold))
                        .foregroundStyle(Color(hex: "5A3FA0"))
                    Text("\(participant.rank)")
                        .font(.athar(22, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: isWinner ? 88 : (participant.rank == 2 ? 68 : 55))
                        .background(isWinner ? AtharTheme.gold : Color(hex: "5A3FA0").opacity(0.82))
                        .clipShape(
                            UnevenRoundedRectangle(
                                topLeadingRadius: 14,
                                bottomLeadingRadius: 3,
                                bottomTrailingRadius: 3,
                                topTrailingRadius: 14
                            )
                        )
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 8)
    }

    private func userResult(_ user: CompetitionParticipant) -> some View {
        VStack(spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("نتيجتك")
                        .font(.athar(13, weight: .semibold))
                        .foregroundStyle(AtharTheme.secondaryText)
                    Text("المركز \(user.rank) من \(engine.participants.count)")
                        .font(.athar(22, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                }
                Spacer()
                Text(user.initials)
                    .font(.athar(22, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 54, height: 54)
                    .background(AtharTheme.gold)
                    .clipShape(Circle())
            }

            HStack(spacing: 10) {
                finalMetric(value: user.score.formatted(), label: "درجة الأداء")
                finalMetric(value: "\(user.correctAnswers)/\(engine.questionCount)", label: "إجابات صحيحة")
                finalMetric(value: engine.userAllocation?.rewardPoints.formatted() ?? "0", label: "نقاطك")
            }
        }
        .atharCard()
    }

    private var poolAuditCard: some View {
        VStack(spacing: 11) {
            HStack {
                Label("تدقيق حوض النقاط", systemImage: "checkmark.shield.fill")
                    .font(.athar(16, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Spacer()
                Text(engine.totalDistributed == engine.definition.rewardPool ? "مكتمل" : "قيد الحساب")
                    .font(.athar(11, weight: .bold))
                    .foregroundStyle(AtharTheme.emerald)
            }
            HStack {
                Text("الحوض المحدد")
                Spacer()
                Text(engine.definition.rewardPool.formatted())
            }
            HStack {
                Text("الموزع فعليًا")
                Spacer()
                Text(engine.totalDistributed.formatted())
            }
        }
        .font(.athar(13, weight: .semibold))
        .foregroundStyle(AtharTheme.secondaryText)
        .atharCard(background: AtharTheme.paleMint)
    }

    private func finalMetric(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.athar(17, weight: .bold))
                .foregroundStyle(Color(hex: "5A3FA0"))
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.athar(9, weight: .medium))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(AtharTheme.pageBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct ImpactRoundView: View {
    @EnvironmentObject private var model: AppModel
    let competition: CompetitionDefinition

    private var activeBox: MemorialOpportunity? {
        model.boxes.first(where: { $0.isShareable })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Label("جولة الأثر", systemImage: "heart.circle.fill")
                    .font(.athar(21, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("اختر خطوة أثر تدعم الجمعية ماليًا، واحصل على نقاط إضافية بعد التحقق")
                    .font(.athar(12))
                    .foregroundStyle(AtharTheme.secondaryText)
            }

            if let box = activeBox {
                impactButton(
                    symbol: "gift.fill",
                    title: "انشر صندوق \(box.deceasedName)",
                    reward: "+٥ بعد زيارة الرابط",
                    tint: AtharTheme.emerald,
                    claimed: model.hasClaimedImpactBonus(boxBonusKey(box))
                ) {
                    model.startShare(
                        url: box.shareURL,
                        message: "أنهيت مسابقة الجمعة القرآنية، وأدعوك لمشاركتي الأجر في صندوق \(box.deceasedName).",
                        resourceID: box.id,
                        demoBonusPoints: 5,
                        bonusKey: boxBonusKey(box)
                    )
                }
            }

            impactButton(
                symbol: "paperplane.fill",
                title: "انشر رابط التبرع العام",
                reward: "+٥ بعد زيارة الرابط",
                tint: Color(hex: "3E73C7"),
                claimed: model.hasClaimedImpactBonus(generalBonusKey)
            ) {
                model.startShare(
                    url: model.generalShareURL,
                    message: "شاركت اليوم في مسابقة الجمعة القرآنية، وساهم معنا في تعليم كتاب الله.",
                    demoBonusPoints: 5,
                    bonusKey: generalBonusKey
                )
            }

            impactButton(
                symbol: "plus.circle.fill",
                title: "أنشئ صندوقًا جديدًا",
                reward: "+٢٠ بعد الاعتماد",
                tint: AtharTheme.gold,
                claimed: model.hasClaimedImpactBonus(boxCreationBonusKey)
            ) {
                model.prepareBoxBonus(key: boxCreationBonusKey, points: 20)
                model.selectedTab = .boxes
            }
        }
        .atharCard(background: Color(hex: "FFF9EC"))
    }

    private var generalBonusKey: String { "\(competition.id):general-share" }
    private var boxCreationBonusKey: String { "\(competition.id):create-box" }
    private func boxBonusKey(_ box: MemorialOpportunity) -> String {
        "\(competition.id):box-share:\(box.id)"
    }

    private func impactButton(
        symbol: String,
        title: String,
        reward: String,
        tint: Color,
        claimed: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: claimed ? "checkmark.circle.fill" : symbol)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(tint)
                    .frame(width: 42, height: 42)
                    .background(tint.opacity(0.11))
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.athar(14, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text(claimed ? "تم تنفيذها" : reward)
                        .font(.athar(11, weight: .semibold))
                        .foregroundStyle(claimed ? AtharTheme.emerald : tint)
                }
                Spacer()
                Image(systemName: "chevron.left")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(AtharTheme.secondaryText)
            }
            .padding(11)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(claimed)
        .opacity(claimed ? 0.65 : 1)
    }
}
