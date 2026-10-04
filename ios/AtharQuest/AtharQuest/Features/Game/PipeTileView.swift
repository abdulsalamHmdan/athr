import SwiftUI

struct PipeTileView: View {
    let tile: PipeTile
    let hasWater: Bool
    let isHighlighted: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(tileBackground)

                Canvas { context, size in
                    let center = CGPoint(x: size.width / 2, y: size.height / 2)
                    let pipeWidth = max(size.width * 0.24, 10)
                    let waterWidth = max(size.width * 0.105, 5)

                    for direction in tile.openings {
                        var path = Path()
                        path.move(to: center)
                        path.addLine(to: edgePoint(for: direction, size: size))
                        context.stroke(
                            path,
                            with: .color(Color(hex: "B7A886")),
                            style: StrokeStyle(lineWidth: pipeWidth, lineCap: .butt)
                        )
                        context.stroke(
                            path,
                            with: .color(hasWater ? Color(hex: "62C6DD") : Color(hex: "E8DDC4")),
                            style: StrokeStyle(lineWidth: waterWidth, lineCap: .round)
                        )
                    }

                    if tile.kind != .empty {
                        let hub = CGRect(
                            x: center.x - pipeWidth / 2,
                            y: center.y - pipeWidth / 2,
                            width: pipeWidth,
                            height: pipeWidth
                        )
                        context.fill(Path(ellipseIn: hub), with: .color(Color(hex: "B7A886")))

                        let waterHub = CGRect(
                            x: center.x - waterWidth / 2,
                            y: center.y - waterWidth / 2,
                            width: waterWidth,
                            height: waterWidth
                        )
                        context.fill(
                            Path(ellipseIn: waterHub),
                            with: .color(hasWater ? Color(hex: "62C6DD") : Color(hex: "E8DDC4"))
                        )
                    }
                }

                if tile.role == .source {
                    Image(systemName: "drop.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(7)
                        .background(Color(hex: "3FAAC5"))
                        .clipShape(Circle())
                } else if tile.role == .goal {
                    Image(systemName: hasWater ? "leaf.fill" : "leaf")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(hasWater ? .white : AtharTheme.forest)
                        .padding(7)
                        .background(hasWater ? AtharTheme.emerald : AtharTheme.mint)
                        .clipShape(Circle())
                }

                if tile.isLocked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(AtharTheme.ink.opacity(0.55))
                        .padding(5)
                        .background(.white.opacity(0.82))
                        .clipShape(Circle())
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .padding(5)
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(
                        isHighlighted ? AtharTheme.gold : AtharTheme.divider.opacity(0.7),
                        lineWidth: isHighlighted ? 3 : 1
                    )
            }
            .shadow(color: hasWater ? Color(hex: "62C6DD").opacity(0.22) : .clear, radius: 8)
            .aspectRatio(1, contentMode: .fit)
        }
        .buttonStyle(PuzzleTileButtonStyle())
        .disabled(tile.isLocked || tile.kind == .empty)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint(tile.isLocked ? "قطعة ثابتة" : "اضغط لتدويرها باتجاه عقارب الساعة")
    }

    private var tileBackground: Color {
        if tile.role == .source { return Color(hex: "E0F4F8") }
        if tile.role == .goal { return AtharTheme.paleMint }
        return hasWater ? Color(hex: "EFFAFC") : Color(hex: "FAF8F2")
    }

    private var accessibilityLabel: String {
        switch tile.role {
        case .source: "منبع الماء"
        case .goal: hasWater ? "الشتلة وصلها الماء" : "الشتلة تنتظر الماء"
        case .normal: tile.kind == .empty ? "أرض فارغة" : "قطعة مسار"
        }
    }

    private func edgePoint(for direction: GridDirection, size: CGSize) -> CGPoint {
        switch direction {
        case .north: CGPoint(x: size.width / 2, y: 0)
        case .east: CGPoint(x: size.width, y: size.height / 2)
        case .south: CGPoint(x: size.width / 2, y: size.height)
        case .west: CGPoint(x: 0, y: size.height / 2)
        }
    }
}

private struct PuzzleTileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
            .rotationEffect(.degrees(configuration.isPressed ? 3 : 0))
            .animation(.spring(response: 0.2, dampingFraction: 0.65), value: configuration.isPressed)
    }
}
