import SwiftUI

struct GameHubView: View {
    @EnvironmentObject private var model: AppModel

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 18) {
                PageHeader(
                    title: "مسار الماء",
                    subtitle: "صل الماء بالشتلة واجعل الواحة تنمو",
                    symbol: "gamecontroller.fill"
                )

                OasisArtwork(
                    stage: model.gameProgress.oasisStage,
                    trees: model.gameProgress.treesGrown,
                    showsLabel: false
                )
                .frame(height: 210)
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(model.gameProgress.treesGrown) أشجار")
                            .font(.athar(19, weight: .bold))
                        Text("كل مرحلة جديدة تنبت شجرة")
                            .font(.athar(12, weight: .medium))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 15)
                    .padding(.vertical, 10)
                    .background(AtharTheme.ink.opacity(0.8))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .padding(13)
                }

                if let nextLevel = PuzzleLevel.all.first(where: { $0.id == model.gameProgress.unlockedLevel }) {
                    NextLevelCard(level: nextLevel)
                }

                HStack {
                    SectionHeading(title: "المراحل", subtitle: "١٢ لغزًا متدرجًا")
                    Spacer()
                    if let profile = model.profile {
                        CompactPill(
                            symbol: profile.playStyle == .calm ? "leaf.fill" : "bolt.fill",
                            text: profile.playStyle.title,
                            tint: profile.playStyle == .calm ? AtharTheme.emerald : AtharTheme.gold
                        )
                    }
                }

                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(PuzzleLevel.all) { level in
                        LevelButton(
                            level: level,
                            isUnlocked: level.id <= model.gameProgress.unlockedLevel,
                            stars: model.gameProgress.bestStarsByLevel[level.id] ?? 0,
                            playStyle: model.profile?.playStyle ?? .calm
                        )
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Label("كيف تلعب؟", systemImage: "questionmark.circle.fill")
                        .font(.athar(18, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text("اضغط على القطعة لتدور. عندما يتصل المسار من قطرة الماء إلى الشتلة تفوز. النمط الهادئ بلا مؤقت، ونمط التحدي يحسب الوقت والنجوم.")
                        .font(.athar(14))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .lineSpacing(4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .atharCard(background: AtharTheme.paleMint)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .background(AtharTheme.pageBackground)
        .navigationBarHidden(true)
    }
}

private struct NextLevelCard: View {
    @EnvironmentObject private var model: AppModel
    let level: PuzzleLevel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("التالي: \(level.title)")
                        .font(.athar(21, weight: .bold))
                    Text(level.subtitle)
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                }
                Spacer()
                Text("\(level.id)")
                    .font(.athar(22, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(AtharTheme.forest)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }

            NavigationLink {
                OasisGameView(level: level, playStyle: model.profile?.playStyle ?? .calm)
            } label: {
                Label("ابدأ اللعب", systemImage: "play.fill")
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .atharCard()
    }
}

private struct LevelButton: View {
    let level: PuzzleLevel
    let isUnlocked: Bool
    let stars: Int
    let playStyle: PlayStyle

    var body: some View {
        Group {
            if isUnlocked {
                NavigationLink {
                    OasisGameView(level: level, playStyle: playStyle)
                } label: {
                    content
                }
            } else {
                content
            }
        }
        .buttonStyle(.plain)
        .disabled(!isUnlocked)
    }

    private var content: some View {
        VStack(spacing: 8) {
            Image(systemName: isUnlocked ? "drop.fill" : "lock.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(isUnlocked ? Color(hex: "43ABC4") : AtharTheme.secondaryText)
            Text("\(level.id)")
                .font(.athar(20, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
            HStack(spacing: 2) {
                ForEach(0..<3, id: \.self) { index in
                    Image(systemName: index < stars ? "star.fill" : "star")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(index < stars ? AtharTheme.gold : AtharTheme.divider)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(isUnlocked ? .white : AtharTheme.divider.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AtharTheme.divider, lineWidth: 1)
        }
    }
}
