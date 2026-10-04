import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            if let profile = model.profile, let impact = model.impact {
                LazyVStack(spacing: 22) {
                    greeting(profile)

                    HomeCompetitionCard {
                        model.selectedTab = .game
                    }

                    HStack(spacing: 12) {
                        BalanceBadge(
                            value: profile.gameSeeds,
                            label: "نقاط التدريب",
                            symbol: "brain.head.profile",
                            tint: AtharTheme.emerald
                        )
                        BalanceBadge(
                            value: profile.rewardPoints,
                            label: "رصيد المتجر",
                            symbol: "seal.fill",
                            tint: AtharTheme.gold
                        )
                    }

                    if let mission = model.missions.first(where: {
                        $0.state == .available || $0.state == .inProgress || $0.state == .completed
                    }) {
                        VStack(spacing: 12) {
                            SectionHeading(title: "مهمتك الآن", subtitle: "خطوة صغيرة كل مرة")
                            HomeMissionCard(mission: mission)
                        }
                    }

                    VStack(spacing: 13) {
                        SectionHeading(title: "أثرك الحقيقي", subtitle: "يأتي من التبرعات الموثّقة فقط")
                        HStack(spacing: 10) {
                            ImpactMetric(
                                value: impact.totalRaised.sarFormatted,
                                label: "تبرعات عبرك",
                                symbol: "heart.fill",
                                tint: AtharTheme.coral
                            )
                            ImpactMetric(
                                value: impact.donors.formatted(.number.locale(Locale(identifier: "ar_SA"))),
                                label: "متبرعًا",
                                symbol: "person.2.fill",
                                tint: AtharTheme.forest
                            )
                        }
                        HStack(spacing: 10) {
                            ImpactMetric(
                                value: impact.successfulShares.formatted(.number.locale(Locale(identifier: "ar_SA"))),
                                label: "مشاركة",
                                symbol: "paperplane.fill",
                                tint: Color(hex: "5775C5")
                            )
                            ImpactMetric(
                                value: impact.activeBoxes.formatted(.number.locale(Locale(identifier: "ar_SA"))),
                                label: "صندوق نشط",
                                symbol: "gift.fill",
                                tint: AtharTheme.gold
                            )
                        }
                    }

                    collectiveCard(impact)
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 14)
            }
        }
        .refreshable { await model.refresh() }
        .background(AtharTheme.pageBackground)
        .navigationBarHidden(true)
    }

    private func greeting(_ profile: AmbassadorProfile) -> some View {
        HStack(spacing: 13) {
            VStack(alignment: .leading, spacing: 4) {
                Text("حيّاك الله، \(profile.name)")
                    .font(.athar(26, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("كل خطوة منك توسّع دائرة الأثر")
                    .font(.athar(14))
                    .foregroundStyle(AtharTheme.secondaryText)
            }
            Spacer()
            NavigationLink {
                ProfileView()
            } label: {
                Text(profile.avatarInitials)
                    .font(.athar(20, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(AtharTheme.forest)
                    .clipShape(Circle())
                    .overlay(alignment: .bottomTrailing) {
                        Text("\(profile.level)")
                            .font(.athar(10, weight: .bold))
                            .foregroundStyle(AtharTheme.ink)
                            .frame(width: 21, height: 21)
                            .background(AtharTheme.sand)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                    }
            }
            .accessibilityLabel("الملف الشخصي، المستوى \(profile.level)")
        }
    }

    private func collectiveCard(_ impact: ImpactSummary) -> some View {
        let raised = NSDecimalNumber(decimal: impact.collectiveSeasonRaised).doubleValue
        let target = NSDecimalNumber(decimal: impact.collectiveSeasonTarget).doubleValue
        let progress = target > 0 ? raised / target : 0

        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("موسمنا معًا")
                        .font(.athar(20, weight: .bold))
                    Text("هدف جماعي، بلا ضغط أو ترتيب فردي")
                        .font(.athar(13))
                        .opacity(0.76)
                }
                Spacer()
                Image(systemName: "person.3.fill")
                    .font(.system(size: 22, weight: .bold))
            }
            AtharProgressBar(value: progress, tint: AtharTheme.sand, height: 11)
            HStack {
                Text(impact.collectiveSeasonRaised.sarFormatted)
                    .font(.athar(17, weight: .bold))
                Spacer()
                Text("من \(impact.collectiveSeasonTarget.sarFormatted)")
                    .font(.athar(13, weight: .medium))
                    .opacity(0.8)
            }
        }
        .foregroundStyle(.white)
        .atharCard(background: AtharTheme.forest)
    }
}

private struct HomeCompetitionCard: View {
    @EnvironmentObject private var model: AppModel
    let action: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "3F237C"), Color(hex: "7052C5")],
                startPoint: .topTrailing,
                endPoint: .bottomLeading
            )

            Circle()
                .fill(.white.opacity(0.08))
                .frame(width: 210, height: 210)
                .offset(x: -120, y: -95)

            Circle()
                .fill(AtharTheme.gold.opacity(0.17))
                .frame(width: 150, height: 150)
                .offset(x: 145, y: 100)

            VStack(spacing: 17) {
                HStack {
                    Label(model.isDemoMode ? "الجمعة • ٨:٣٠ مساءً" : "المسابقات المباشرة", systemImage: "dot.radiowaves.left.and.right")
                        .font(.athar(12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Color.red)
                        .clipShape(Capsule())

                    Spacer()

                    Label(model.isDemoMode ? "٥٠٬٠٠٠ نقطة" : "مكافآت الأثر", systemImage: "seal.fill")
                        .font(.athar(13, weight: .bold))
                        .foregroundStyle(AtharTheme.gold)
                }

                HStack(spacing: 16) {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 54, weight: .bold))
                        .foregroundStyle(AtharTheme.gold)
                        .frame(width: 88, height: 88)
                        .background(.white.opacity(0.1))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 7) {
                        Text(model.isDemoMode ? "مسابقة الجمعة القرآنية" : "مسابقات الأثر")
                            .font(.athar(23, weight: .bold))
                        Text("أجب أسرع، اصعد في الترتيب، واقتسم حوض النقاط")
                            .font(.athar(13, weight: .medium))
                            .lineSpacing(3)
                            .opacity(0.84)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(action: action) {
                    Label(model.isDemoMode ? "دخول المسابقة التجريبية" : "المسابقات والنتائج", systemImage: "play.fill")
                        .font(.athar(15, weight: .bold))
                        .foregroundStyle(Color(hex: "3F237C"))
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .foregroundStyle(.white)
            .padding(19)
        }
        .frame(height: 270)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: Color(hex: "3F237C").opacity(0.18), radius: 18, y: 9)
        .accessibilityElement(children: .contain)
    }
}

private struct HomeMissionCard: View {
    @EnvironmentObject private var model: AppModel
    let mission: AmbassadorMission

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: mission.symbol)
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(AtharTheme.forest)
                    .frame(width: 48, height: 48)
                    .background(AtharTheme.mint)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                VStack(alignment: .leading, spacing: 5) {
                    Text(mission.title)
                        .font(.athar(18, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text(mission.detail)
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .lineSpacing(3)
                }
                Spacer()
            }

            AtharProgressBar(value: mission.progressFraction)

            HStack {
                CompactPill(symbol: "leaf.fill", text: "+\(mission.seedReward)")
                Spacer()
                if mission.state == .completed {
                    Button("استلام") {
                        Task { await model.claimMission(mission) }
                    }
                    .font(.athar(14, weight: .bold))
                    .buttonStyle(.borderedProminent)
                    .tint(AtharTheme.forest)
                } else {
                    Button(mission.actionTitle) {
                        model.goToMissionAction(mission)
                    }
                    .font(.athar(14, weight: .bold))
                    .buttonStyle(.bordered)
                    .tint(AtharTheme.forest)
                }
            }
        }
        .atharCard()
    }
}

private struct ImpactMetric: View {
    let value: String
    let label: String
    let symbol: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(tint)
            Text(value)
                .font(.athar(value.count > 9 ? 17 : 21, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.athar(12, weight: .medium))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .atharCard(padding: 15)
    }
}

extension AmbassadorMission {
    var symbol: String {
        switch kind {
        case .shareGeneralLink: "paperplane.fill"
        case .createMemorialBox: "gift.fill"
        case .firstBoxDonation: "heart.fill"
        case .weeklyImpact: "chart.line.uptrend.xyaxis"
        case .playPuzzle: "puzzlepiece.fill"
        }
    }
}
