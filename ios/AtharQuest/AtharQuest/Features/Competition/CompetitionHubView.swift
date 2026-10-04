import Combine
import Foundation
import SwiftUI

struct CompetitionHubView: View {
    @EnvironmentObject private var model: AppModel
    @State private var now = Date.now

    private let competition = QuranQuestionBank.fridayCompetition
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                PageHeader(
                    title: "مسابقة الجمعة",
                    subtitle: "تنافس مباشر، ترتيب لحظي، ومكافآت حقيقية",
                    symbol: "trophy.fill"
                )

                liveHero
                countdownCard

                if let profile = model.profile {
                    HStack(spacing: 12) {
                        BalanceBadge(
                            value: profile.rewardPoints,
                            label: "رصيد المتجر",
                            symbol: "seal.fill",
                            tint: AtharTheme.gold
                        )
                        BalanceBadge(
                            value: competition.rewardPool,
                            label: "حوض المسابقة",
                            symbol: "trophy.fill",
                            tint: Color(hex: "6D5AA7")
                        )
                    }
                }

                scoringCard

                SectionHeading(
                    title: "بين المسابقات",
                    subtitle: "تدرّب على سرعة التركيز دون التأثير في ترتيب الجمعة"
                )

                NavigationLink {
                    GameHubView()
                } label: {
                    HStack(spacing: 15) {
                        Image(systemName: "drop.fill")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(Color(hex: "43ABC4"))
                            .frame(width: 68, height: 68)
                            .background(Color(hex: "DDF2F7"))
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        VStack(alignment: .leading, spacing: 5) {
                            Text("مسار الماء")
                                .font(.athar(18, weight: .bold))
                                .foregroundStyle(AtharTheme.ink)
                            Text("لعبة تدريبية قصيرة متاحة في أي وقت")
                                .font(.athar(13))
                                .foregroundStyle(AtharTheme.secondaryText)
                        }
                        Spacer()
                        Image(systemName: "chevron.left")
                            .foregroundStyle(AtharTheme.secondaryText)
                    }
                    .atharCard(padding: 14)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 10) {
                    Label("محتوى موثوق", systemImage: "checkmark.shield.fill")
                        .font(.athar(17, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text("بعد كل إجابة يظهر شرح مختصر ومرجعها. النسخة الإنتاجية لا تنشر أي سؤال قبل مراجعته واعتماده من القسم التعليمي في الجمعية.")
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .lineSpacing(3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .atharCard(background: AtharTheme.paleMint)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .background(AtharTheme.pageBackground)
        .navigationBarHidden(true)
        .onReceive(timer) { now = $0 }
    }

    private var liveHero: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "5A3FA0"), Color(hex: "2D245D")],
                startPoint: .topTrailing,
                endPoint: .bottomLeading
            )

            Circle()
                .fill(.white.opacity(0.07))
                .frame(width: 210, height: 210)
                .offset(x: -120, y: -70)

            Circle()
                .fill(AtharTheme.gold.opacity(0.16))
                .frame(width: 150, height: 150)
                .offset(x: 135, y: 95)

            VStack(spacing: 18) {
                HStack {
                    Label("تجربة مباشرة", systemImage: "dot.radiowaves.left.and.right")
                        .font(.athar(12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.red.opacity(0.88))
                        .clipShape(Capsule())
                    Spacer()
                    Label("١٢ سؤالًا", systemImage: "questionmark.circle.fill")
                        .font(.athar(12, weight: .bold))
                        .foregroundStyle(.white.opacity(0.9))
                }

                VStack(spacing: 7) {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundStyle(AtharTheme.sand)
                    Text(competition.title)
                        .font(.athar(27, weight: .bold))
                        .foregroundStyle(.white)
                    Text("تؤثر سرعة إجابتك وصحتها مباشرة في نصيبك من النقاط")
                        .font(.athar(14))
                        .foregroundStyle(.white.opacity(0.78))
                        .multilineTextAlignment(.center)
                }

                NavigationLink {
                    LiveCompetitionView(
                        definition: competition,
                        userName: model.profile?.name ?? "سفير الأثر"
                    )
                } label: {
                    Label("جرّب المسابقة الآن", systemImage: "play.fill")
                        .font(.athar(17, weight: .bold))
                        .foregroundStyle(Color(hex: "2D245D"))
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .shadow(color: Color(hex: "2D245D").opacity(0.2), radius: 20, y: 10)
    }

    private var countdownCard: some View {
        let remaining = max(competition.scheduledAt.timeIntervalSince(now), 0)
        let days = Int(remaining) / 86_400
        let hours = (Int(remaining) % 86_400) / 3_600
        let minutes = (Int(remaining) % 3_600) / 60
        let seconds = Int(remaining) % 60

        return VStack(spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("الموعد الرسمي القادم")
                        .font(.athar(18, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text(competition.scheduledAt.formatted(
                        .dateTime
                            .locale(Locale(identifier: "ar_SA"))
                            .weekday(.wide)
                            .hour()
                            .minute()
                    ))
                    .font(.athar(13, weight: .medium))
                    .foregroundStyle(AtharTheme.secondaryText)
                }
                Spacer()
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(AtharTheme.gold)
            }

            HStack(spacing: 8) {
                CountdownUnit(value: days, label: "يوم")
                CountdownUnit(value: hours, label: "ساعة")
                CountdownUnit(value: minutes, label: "دقيقة")
                CountdownUnit(value: seconds, label: "ثانية")
            }
        }
        .atharCard()
    }

    private var scoringCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeading(title: "كيف توزع النقاط؟", subtitle: "حوض ثابت مهما زاد المشاركون")

            HStack(spacing: 10) {
                scoreStep(symbol: "checkmark.circle.fill", title: "صحة", detail: "الخاطئة = صفر")
                scoreStep(symbol: "timer", title: "سرعة", detail: "الأسرع أعلى")
                scoreStep(symbol: "percent", title: "نسبة", detail: "من ٥٠ ألف")
            }

            Text("نصيبك = ٥٠٬٠٠٠ × درجتك ÷ مجموع درجات جميع المؤهلين")
                .font(.athar(14, weight: .bold))
                .foregroundStyle(Color(hex: "5A3FA0"))
                .frame(maxWidth: .infinity)
                .padding(13)
                .background(Color(hex: "5A3FA0").opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .atharCard()
    }

    private func scoreStep(symbol: String, title: String, detail: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color(hex: "5A3FA0"))
            Text(title)
                .font(.athar(14, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
            Text(detail)
                .font(.athar(10, weight: .medium))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 11)
        .background(AtharTheme.pageBackground)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}

private struct CountdownUnit: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(String(format: "%02d", value))
                .font(.athar(19, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(AtharTheme.ink)
                .contentTransition(.numericText())
            Text(label)
                .font(.athar(9, weight: .semibold))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(AtharTheme.pageBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct RemoteCompetitionHubView: View {
    @EnvironmentObject private var model: AppModel
    @State private var competitions: [RemoteCompetition] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PageHeader(title: "مسابقات الأثر", subtitle: "تنافس مع السفراء واستلم مكافأتك", symbol: "trophy.fill")
                if loading { ProgressView() }
                if let error { Text(error).foregroundStyle(.red); Button("إعادة المحاولة") { Task { await load() } } }
                if !loading && error == nil && competitions.isEmpty {
                    ContentUnavailableView("نترقب المسابقة القادمة", systemImage: "calendar", description: Text("سيظهر موعدها هنا بعد إعلانها من الجمعية."))
                }
                ForEach(competitions) { competition in
                    NavigationLink {
                        RemoteCompetitionView(competition: competition)
                    } label: {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(competition.title).font(.athar(22, weight: .bold))
                            Text(competition.scheduledAt.formatted(date: .abbreviated, time: .shortened))
                            Text("\(competition.questionCount) سؤال • \(competition.rewardPool.formatted()) نقطة")
                            Text("أكمل \(competition.eligibilityPercent)% من الأسئلة مع إجابة صحيحة للتأهل.").font(.footnote)
                            Label(competition.state == "published" ? "عرض النتائج" : "دخول المسابقة", systemImage: "arrow.left.circle.fill")
                        }.frame(maxWidth: .infinity, alignment: .leading).atharCard()
                    }.buttonStyle(.plain)
                }
                if model.configuration?.gameEnabled == true {
                    NavigationLink { GameHubView() } label: {
                        Label("تدرّب في مسار الماء", systemImage: "drop.fill").frame(maxWidth: .infinity).atharCard()
                    }.buttonStyle(.plain)
                }
            }.padding(18)
        }
        .background(AtharTheme.pageBackground)
        .navigationTitle("المسابقات")
        .task { await load() }
        .refreshable { await load() }
    }
    @MainActor private func load() async {
        loading = true
        defer { loading = false }
        do { competitions = try await model.liveAPI?.competitions() ?? []; error = nil }
        catch { self.error = error.localizedDescription }
    }
}

struct RemoteCompetitionView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase
    let competition: RemoteCompetition
    @State private var snapshot: RemoteCompetitionSnapshot?
    @State private var error: String?
    @State private var busy = false
    @State private var connected = false
    @State private var serverOffset: TimeInterval = 0
    @State private var lastSync = Date.distantPast
    @State private var notice: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Text(competition.title).font(.athar(26, weight: .bold))
                if let error {
                    Text(error).foregroundStyle(.red).font(.footnote)
                    Button("إعادة الاتصال") { Task { await sync() } }
                }
                if let notice { Text(notice).foregroundStyle(AtharTheme.forest) }
                if let s = snapshot {
                    Text("\(s.participantCount) مشارك • \(competition.rewardPool.formatted()) نقطة").foregroundStyle(.secondary)
                    if !s.joined && ["scheduled", "question", "reveal"].contains(s.state) {
                        Button("الانضمام للمسابقة") { Task { await join() } }.buttonStyle(PrimaryButtonStyle()).disabled(busy || !connected)
                    }
                    if s.state == "scheduled" {
                        Image(systemName: "clock.fill").font(.system(size: 50)).foregroundStyle(AtharTheme.gold)
                        Text("أنت في صالة الانتظار").font(.title2.bold())
                        Text("الموعد: \(competition.scheduledAt.formatted(date: .abbreviated, time: .shortened))")
                        Text("تبدأ الجولة عند تشغيلها من المشرف.").font(.footnote)
                    }
                    if s.state == "paused" { Text("أوقف المشرف المسابقة مؤقتًا. انتظر الاستئناف.").atharCard() }
                    if s.state == "cancelled" { Text("أُلغيت المسابقة. تابع مواعيد الجولات القادمة.").atharCard() }
                    if let q = s.question {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Text("السؤال \(q.index) من \(s.questionCount)")
                                Spacer()
                                if s.state == "question" {
                                    TimelineView(.periodic(from: .now, by: 0.2)) { context in
                                        Text("\(max(0, Int(ceil(q.closesAt.timeIntervalSince(context.date.addingTimeInterval(serverOffset)))))) ث")
                                            .monospacedDigit().foregroundStyle(AtharTheme.gold)
                                    }
                                }
                            }.font(.footnote.bold())
                            Text(q.text).font(.athar(22, weight: .bold))
                            ForEach(Array(q.choices.enumerated()), id: \.offset) { index, choice in
                                Button { Task { await answer(q, choice: index) } } label: {
                                    HStack {
                                        Text(choice)
                                        Spacer()
                                        if q.correctIndex == index { Image(systemName: "checkmark.seal.fill") }
                                        else if q.selectedChoice == index { Image(systemName: "checkmark.circle") }
                                    }.padding(15).frame(maxWidth: .infinity, alignment: .leading)
                                        .background(q.correctIndex == index ? AtharTheme.mint : Color.white)
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }.buttonStyle(.plain)
                                    .disabled(q.answered || busy || s.state != "question" || !connected || Date().timeIntervalSince(lastSync) > 4 || q.closesAt <= Date().addingTimeInterval(serverOffset))
                            }
                            if q.answered && s.state == "question" { Text("سُجلت إجابتك. تظهر النتيجة بعد انتهاء الوقت.").font(.footnote) }
                            if let explanation = q.explanation {
                                Text(explanation)
                                Text(q.reference ?? "").font(.footnote).foregroundStyle(.secondary)
                                Text("درجتك: \(q.score ?? 0)").bold()
                            }
                        }.atharCard(background: AtharTheme.paleMint)
                    }
                    if s.state == "calculating" {
                        ProgressView()
                        Text("انتهت الأسئلة. تظهر النتائج بعد اعتمادها من المشرف.")
                    }
                    if s.state == "published" {
                        VStack(spacing: 16) {
                            Image(systemName: "trophy.fill").font(.system(size: 55)).foregroundStyle(AtharTheme.gold)
                            Text(s.rank > 0 ? "مركزك \(s.rank)" : "نُشرت النتائج").font(.title2.bold())
                            Text("مكافأتك: \(s.rewardPoints.formatted()) نقطة")
                            if s.rewardPoints > 0 && !s.claimed {
                                Button("استلام المكافأة") { Task { await claim() } }.buttonStyle(PrimaryButtonStyle()).disabled(busy || !connected)
                            } else { Text(s.claimed ? "أضيفت المكافأة إلى رصيدك" : "لم تتحقق شروط المكافأة في هذه الجولة").font(.footnote) }
                            Button("شارك الأثر") {
                                model.startShare(url: model.generalShareURL, message: "ساهم معنا في تعليم كتاب الله، وانشر الأثر لمن تحب.")
                            }.buttonStyle(.bordered)
                        }.atharCard()
                    }
                    if !s.leaderboard.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("الترتيب بعد الأسئلة المغلقة").font(.headline)
                            ForEach(s.leaderboard) { rank in
                                HStack { Text("\(rank.rank). \(rank.name)"); Spacer(); Text("\(rank.score)") }
                            }
                        }.atharCard()
                    }
                } else if error == nil { ProgressView("جارٍ الاتصال") }
            }.padding(18)
        }
        .background(AtharTheme.pageBackground)
        .navigationTitle("المسابقة")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: scenePhase) {
            guard scenePhase == .active else { connected = false; return }
            while !Task.isCancelled {
                await sync()
                do { try await Task.sleep(for: .seconds(connected ? 1 : 3)) }
                catch { return }
            }
        }
    }
    @MainActor private func sync() async {
        do {
            guard let api = model.liveAPI else { return }
            let start = Date()
            let s = try await api.snapshot(id: competition.id)
            guard !Task.isCancelled else { return }
            serverOffset = s.serverTime.timeIntervalSince(start.addingTimeInterval(Date().timeIntervalSince(start)/2))
            snapshot = s; connected = true; lastSync = Date(); error = nil
        } catch { connected = false; self.error = "تعذّر الاتصال. نحاول استعادة الجولة؛ لن تُرسل إجابة دون اتصال." }
    }
    @MainActor private func join() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do { try await model.liveAPI?.join(id: competition.id); await sync() }
        catch { notice = error.localizedDescription }
    }
    @MainActor private func answer(_ question: RemoteQuestion, choice: Int) async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do { try await model.liveAPI?.answer(competitionID: competition.id, questionID: question.id, choice: choice); await sync() }
        catch { notice = error.localizedDescription; await sync() }
    }
    @MainActor private func claim() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do { _ = try await model.liveAPI?.claimReward(id: competition.id); await model.refresh(); await sync() }
        catch { notice = error.localizedDescription }
    }
}
