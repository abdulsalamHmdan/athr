import SwiftUI

private enum MissionFilter: String, CaseIterable, Hashable, Identifiable {
    case active = "الحالية"
    case finished = "المكتملة"
    var id: String { rawValue }
}

struct MissionsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var filter: MissionFilter = .active

    private var filteredMissions: [AmbassadorMission] {
        model.missions.filter { mission in
            switch filter {
            case .active: mission.state != .claimed
            case .finished: mission.state == .claimed
            }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                PageHeader(
                    title: "مهام الأثر",
                    subtitle: "أنشطة قصيرة تربط اللعب بالعمل الحقيقي",
                    symbol: "checklist"
                )

                Picker("تصفية المهام", selection: $filter) {
                    ForEach(MissionFilter.allCases) { item in
                        Text(item.rawValue).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                if filteredMissions.isEmpty {
                    EmptyStateView(
                        symbol: filter == .active ? "checkmark.circle.fill" : "clock.fill",
                        title: filter == .active ? "أنجزت كل شيء" : "لا توجد مهام مكتملة بعد",
                        message: filter == .active
                            ? "عد غدًا لمهمات جديدة، أو تدرّب قبل مسابقة الجمعة."
                            : "ستظهر هنا المهمات بعد استلام مكافآتها."
                    )
                } else {
                    ForEach(filteredMissions) { mission in
                        MissionCard(mission: mission)
                    }
                }

                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "shield.checkered")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(AtharTheme.forest)
                    Text("التدريب يمنح رصيدًا تجميليًا فقط. نقاط المنتجات العينية تأتي من مسابقة معتمدة أو أثر يتحقق منه الخادم.")
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .lineSpacing(3)
                }
                .atharCard(background: AtharTheme.paleMint)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .refreshable { await model.refresh() }
        .background(AtharTheme.pageBackground)
        .navigationBarHidden(true)
    }
}

private struct MissionCard: View {
    @EnvironmentObject private var model: AppModel
    let mission: AmbassadorMission

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .top, spacing: 13) {
                Image(systemName: mission.symbol)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(AtharTheme.forest)
                    .frame(width: 48, height: 48)
                    .background(AtharTheme.mint)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                VStack(alignment: .leading, spacing: 5) {
                    Text(mission.title)
                        .font(.athar(19, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text(mission.detail)
                        .font(.athar(14))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .lineSpacing(3)
                }
                Spacer()
            }

            VStack(spacing: 8) {
                AtharProgressBar(value: mission.progressFraction)
                HStack {
                    Text("\(mission.progress) من \(mission.target)")
                    Spacer()
                    Text(mission.progress >= mission.target ? "جاهزة للاستلام" : "قيد التقدّم")
                }
                .font(.athar(12, weight: .semibold))
                .foregroundStyle(AtharTheme.secondaryText)
            }

            HStack(spacing: 8) {
                CompactPill(symbol: "leaf.fill", text: "+\(mission.seedReward)")
                if mission.rewardPointBonus > 0 {
                    CompactPill(
                        symbol: "seal.fill",
                        text: "+\(mission.rewardPointBonus)",
                        tint: AtharTheme.gold
                    )
                }
                Spacer()
            }

            if mission.state == .completed {
                Button {
                    Task { await model.claimMission(mission) }
                } label: {
                    Label("استلام المكافأة", systemImage: "sparkles")
                }
                .buttonStyle(PrimaryButtonStyle())
            } else if mission.state != .claimed {
                Button {
                    model.goToMissionAction(mission)
                } label: {
                    Text(mission.actionTitle)
                }
                .buttonStyle(PrimaryButtonStyle(tint: AtharTheme.emerald))
            }
        }
        .atharCard()
    }
}
