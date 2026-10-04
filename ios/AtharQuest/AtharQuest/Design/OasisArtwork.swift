import SwiftUI

struct OasisArtwork: View {
    var stage: Int
    var trees: Int
    var showsLabel = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isAnimating = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [AtharTheme.sky, Color.white.opacity(0.92)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                Circle()
                    .fill(AtharTheme.sand.opacity(0.82))
                    .frame(width: proxy.size.width * 0.22)
                    .blur(radius: 1)
                    .offset(x: -proxy.size.width * 0.31, y: -proxy.size.height * 0.25)

                HillShape(depth: 0.37)
                    .fill(Color(hex: "BDE4D4"))
                    .offset(y: proxy.size.height * 0.34)

                HillShape(depth: 0.52)
                    .fill(Color(hex: "7AC4A6"))
                    .offset(y: proxy.size.height * 0.47)

                Path { path in
                    path.move(to: CGPoint(x: proxy.size.width * 0.12, y: proxy.size.height * 0.84))
                    path.addCurve(
                        to: CGPoint(x: proxy.size.width * 0.88, y: proxy.size.height * 0.78),
                        control1: CGPoint(x: proxy.size.width * 0.36, y: proxy.size.height * 0.48),
                        control2: CGPoint(x: proxy.size.width * 0.6, y: proxy.size.height * 1.08)
                    )
                }
                .stroke(
                    LinearGradient(
                        colors: [Color.white.opacity(0.75), AtharTheme.sky],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: max(proxy.size.width * 0.07, 20), lineCap: .round)
                )

                ForEach(0..<visibleTreeCount, id: \.self) { index in
                    OasisTree(size: treeSize(index: index, width: proxy.size.width))
                        .position(treePosition(index: index, size: proxy.size))
                        .scaleEffect(isAnimating && !reduceMotion ? 1.03 : 1)
                        .animation(
                            .easeInOut(duration: 1.7 + Double(index % 3) * 0.25)
                                .repeatForever(autoreverses: true),
                            value: isAnimating
                        )
                }

                if stage >= 3 {
                    Image(systemName: "sparkles")
                        .font(.system(size: proxy.size.width * 0.075, weight: .bold))
                        .foregroundStyle(AtharTheme.gold)
                        .position(x: proxy.size.width * 0.76, y: proxy.size.height * 0.19)
                        .opacity(isAnimating ? 1 : 0.42)
                        .animation(
                            reduceMotion ? nil : .easeInOut(duration: 1.25).repeatForever(autoreverses: true),
                            value: isAnimating
                        )
                }

                if showsLabel {
                    VStack(spacing: 2) {
                        Text("واحة الأثر")
                            .font(.athar(22, weight: .bold))
                        Text("المرحلة \(stage) من 5")
                            .font(.athar(12, weight: .semibold))
                            .opacity(0.76)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(AtharTheme.ink.opacity(0.8))
                    .clipShape(Capsule())
                    .position(x: proxy.size.width * 0.5, y: proxy.size.height * 0.2)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
            .onAppear { isAnimating = true }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("واحة الأثر، المرحلة \(stage)، فيها \(trees) أشجار")
    }

    private var visibleTreeCount: Int { min(max(trees, 2), 9) }

    private func treeSize(index: Int, width: CGFloat) -> CGFloat {
        width * (0.11 + CGFloat(index % 3) * 0.012)
    }

    private func treePosition(index: Int, size: CGSize) -> CGPoint {
        let positions: [(CGFloat, CGFloat)] = [
            (0.18, 0.61), (0.34, 0.72), (0.52, 0.59),
            (0.72, 0.7), (0.84, 0.57), (0.27, 0.48),
            (0.62, 0.44), (0.11, 0.77), (0.91, 0.75)
        ]
        let item = positions[index % positions.count]
        return CGPoint(x: size.width * item.0, y: size.height * item.1)
    }
}

private struct HillShape: Shape {
    let depth: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: rect.height * 0.5))
        path.addCurve(
            to: CGPoint(x: rect.width, y: rect.height * 0.4),
            control1: CGPoint(x: rect.width * 0.25, y: rect.height * (0.5 - depth)),
            control2: CGPoint(x: rect.width * 0.72, y: rect.height * (0.5 + depth * 0.35))
        )
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.addLine(to: CGPoint(x: 0, y: rect.height))
        path.closeSubpath()
        return path
    }
}

private struct OasisTree: View {
    let size: CGFloat

    var body: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: size * 0.08)
                .fill(Color(hex: "91633E"))
                .frame(width: size * 0.19, height: size * 0.68)

            ZStack {
                Circle()
                    .fill(AtharTheme.forest)
                    .frame(width: size * 0.72, height: size * 0.72)
                    .offset(x: -size * 0.2, y: -size * 0.33)
                Circle()
                    .fill(AtharTheme.emerald)
                    .frame(width: size * 0.8, height: size * 0.8)
                    .offset(x: size * 0.2, y: -size * 0.28)
                Circle()
                    .fill(Color(hex: "54AE82"))
                    .frame(width: size * 0.7, height: size * 0.7)
                    .offset(y: -size * 0.55)
            }
        }
        .frame(width: size * 1.35, height: size * 1.55)
    }
}
