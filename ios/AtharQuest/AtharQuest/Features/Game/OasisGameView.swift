import Combine
import SwiftUI

struct OasisGameView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @StateObject private var game: PipePuzzleEngine
    @State private var didSubmitWin = false
    @State private var earnedSeeds = 0

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(level: PuzzleLevel, playStyle: PlayStyle) {
        _game = StateObject(wrappedValue: PipePuzzleEngine(level: level, playStyle: playStyle))
    }

    var body: some View {
        ZStack {
            AtharTheme.pageBackground.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    gameHeader
                    board
                    controls
                    hintText
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 24)
            }
            .disabled(game.status == .won || game.status == .lost)

            if game.status == .won {
                WinOverlay(game: game, earnedSeeds: earnedSeeds) { dismiss() }
                    .transition(.scale(scale: 0.92).combined(with: .opacity))
                    .zIndex(5)
            } else if game.status == .lost {
                LossOverlay(game: game) {
                    game.retryAfterLoss()
                } exit: {
                    dismiss()
                }
                .transition(.opacity)
                .zIndex(5)
            }
        }
        .navigationTitle(game.level.title)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(game.status == .won)
        .onReceive(timer) { _ in game.tick() }
        .onChange(of: game.status) { _, status in
            guard status == .won, !didSubmitWin else { return }
            didSubmitWin = true
            let oldBest = model.gameProgress.bestStarsByLevel[game.level.id] ?? 0
            earnedSeeds = max(game.starRating - oldBest, 0) * 12
            AtharHaptics.success(enabled: model.profile?.hapticsEnabled ?? true)
            GameAudio.playSuccess(enabled: model.profile?.soundEnabled ?? true)
            Task {
                await model.completeGame(
                    level: game.level.id,
                    stars: game.starRating,
                    elapsedSeconds: game.elapsedSeconds
                )
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.84), value: game.status)
    }

    private var gameHeader: some View {
        HStack(spacing: 10) {
            GameStat(
                symbol: "arrow.clockwise",
                value: "\(game.rotationCount)",
                label: "دورات",
                tint: AtharTheme.emerald
            )
            GameStat(
                symbol: game.playStyle == .calm ? "infinity" : "timer",
                value: game.playStyle == .calm ? timeText(game.elapsedSeconds) : timeText(game.remainingSeconds),
                label: game.playStyle == .calm ? "الوقت" : "متبقٍ",
                tint: game.playStyle == .calm ? Color(hex: "5775C5") : AtharTheme.gold
            )
            GameStat(
                symbol: "star.fill",
                value: "\(game.starRating)",
                label: "نجوم",
                tint: AtharTheme.gold
            )
        }
        .padding(.top, 8)
    }

    private var board: some View {
        let spacing: CGFloat = 6
        let columns = Array(repeating: GridItem(.flexible(), spacing: spacing), count: game.level.size)
        let flowed = game.flowedTileIDs

        return LazyVGrid(columns: columns, spacing: spacing) {
            ForEach(game.tiles) { tile in
                PipeTileView(
                    tile: tile,
                    hasWater: flowed.contains(tile.id),
                    isHighlighted: game.highlightedTileID == tile.id
                ) {
                    AtharHaptics.tap(enabled: model.profile?.hapticsEnabled ?? true)
                    GameAudio.playPipeTap(enabled: model.profile?.soundEnabled ?? true)
                    game.rotate(tileID: tile.id)
                }
            }
        }
        .padding(9)
        .background(Color(hex: "E8E1D0"))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color(hex: "D4C8AC"), lineWidth: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("لوحة لغز من \(game.level.size) صفوف و\(game.level.size) أعمدة")
    }

    private var controls: some View {
        HStack(spacing: 10) {
            Button {
                game.useHint()
                AtharHaptics.tap(enabled: model.profile?.hapticsEnabled ?? true)
            } label: {
                Label("تلميح", systemImage: "lightbulb.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(AtharTheme.gold)

            Button {
                game.reset()
            } label: {
                Label("إعادة", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(AtharTheme.forest)
        }
        .font(.athar(15, weight: .bold))
        .controlSize(.large)
    }

    private var hintText: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "drop.fill")
                .foregroundStyle(Color(hex: "43ABC4"))
            Text(game.playStyle == .calm
                 ? "لا يوجد مؤقت. خذ وقتك وتتبع اللون الأزرق من القطرة إلى الشتلة."
                 : "أكمل المسار قبل انتهاء الوقت. استخدام التلميح قد يخفض عدد النجوم.")
                .font(.athar(13))
                .foregroundStyle(AtharTheme.secondaryText)
                .lineSpacing(3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .atharCard(background: AtharTheme.paleMint)
    }

    private func timeText(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

private struct GameStat: View {
    let symbol: String
    let value: String
    let label: String
    let tint: Color

    var body: some View {
        VStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(tint)
            Text(value)
                .font(.athar(18, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
                .monospacedDigit()
            Text(label)
                .font(.athar(10, weight: .semibold))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(AtharTheme.divider, lineWidth: 1)
        }
    }
}

private struct WinOverlay: View {
    @ObservedObject var game: PipePuzzleEngine
    let earnedSeeds: Int
    let exit: () -> Void
    @State private var showStars = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.38).ignoresSafeArea()

            VStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(AtharTheme.mint)
                        .frame(width: 94, height: 94)
                    Image(systemName: "leaf.fill")
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(AtharTheme.emerald)
                }

                VStack(spacing: 6) {
                    Text("وصل الماء!")
                        .font(.athar(29, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text("نبتت شجرة جديدة في واحتك")
                        .font(.athar(15))
                        .foregroundStyle(AtharTheme.secondaryText)
                }

                HStack(spacing: 9) {
                    ForEach(0..<3, id: \.self) { index in
                        Image(systemName: index < game.starRating ? "star.fill" : "star")
                            .font(.system(size: 31, weight: .bold))
                            .foregroundStyle(index < game.starRating ? AtharTheme.gold : AtharTheme.divider)
                            .scaleEffect(showStars ? 1 : 0.3)
                            .animation(
                                .spring(response: 0.48, dampingFraction: 0.62)
                                    .delay(Double(index) * 0.12),
                                value: showStars
                            )
                    }
                }

                if earnedSeeds > 0 {
                    CompactPill(
                        symbol: "leaf.fill",
                        text: "+\(earnedSeeds) بذرة",
                        tint: AtharTheme.emerald
                    )
                } else {
                    CompactPill(
                        symbol: "checkmark.seal.fill",
                        text: "أفضل نتيجة محفوظة",
                        tint: AtharTheme.emerald
                    )
                }

                Button("العودة للمراحل", action: exit)
                    .buttonStyle(PrimaryButtonStyle())
            }
            .padding(24)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
            .shadow(color: .black.opacity(0.2), radius: 30, y: 18)
            .padding(.horizontal, 26)
        }
        .onAppear { showStars = true }
    }
}

private struct LossOverlay: View {
    @ObservedObject var game: PipePuzzleEngine
    let retry: () -> Void
    let exit: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.38).ignoresSafeArea()
            VStack(spacing: 17) {
                Image(systemName: "hourglass.bottomhalf.filled")
                    .font(.system(size: 50, weight: .bold))
                    .foregroundStyle(AtharTheme.gold)
                Text("انتهى الوقت")
                    .font(.athar(27, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("اقترب الماء من الشتلة. حاول مرة أخرى أو غيّر النمط إلى هادئ من ملفك الشخصي.")
                    .font(.athar(14))
                    .foregroundStyle(AtharTheme.secondaryText)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                Button("إعادة المحاولة", action: retry)
                    .buttonStyle(PrimaryButtonStyle())
                Button("العودة", action: exit)
                    .font(.athar(15, weight: .bold))
                    .foregroundStyle(AtharTheme.secondaryText)
            }
            .padding(24)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
            .padding(.horizontal, 26)
        }
    }
}
