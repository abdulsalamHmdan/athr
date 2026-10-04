import SwiftUI

enum AtharTheme {
    static let ink = Color(hex: "16342C")
    static let forest = Color(hex: "176B57")
    static let emerald = Color(hex: "1D8A6A")
    static let mint = Color(hex: "DDF4EA")
    static let paleMint = Color(hex: "F2FAF7")
    static let sand = Color(hex: "F4E2B7")
    static let gold = Color(hex: "D69A2D")
    static let sky = Color(hex: "DDF2F7")
    static let coral = Color(hex: "E87D65")
    static let surface = Color.white
    static let secondaryText = Color(hex: "66736F")
    static let divider = Color(hex: "E6ECE9")
    static let pageBackground = Color(hex: "F5F8F6")

    static let cardRadius: CGFloat = 24
    static let buttonRadius: CGFloat = 18
}

extension Color {
    init(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var integer: UInt64 = 0
        Scanner(string: value).scanHexInt64(&integer)

        let red: UInt64
        let green: UInt64
        let blue: UInt64
        let alpha: UInt64

        switch value.count {
        case 3:
            red = (integer >> 8) * 17
            green = (integer >> 4 & 0xF) * 17
            blue = (integer & 0xF) * 17
            alpha = 255
        case 8:
            red = integer >> 24
            green = integer >> 16 & 0xFF
            blue = integer >> 8 & 0xFF
            alpha = integer & 0xFF
        default:
            red = integer >> 16
            green = integer >> 8 & 0xFF
            blue = integer & 0xFF
            alpha = 255
        }

        self.init(
            .sRGB,
            red: Double(red) / 255,
            green: Double(green) / 255,
            blue: Double(blue) / 255,
            opacity: Double(alpha) / 255
        )
    }
}

extension Font {
    static func athar(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

struct CardStyle: ViewModifier {
    var padding: CGFloat = 18
    var background: Color = AtharTheme.surface

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: AtharTheme.cardRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: AtharTheme.cardRadius, style: .continuous)
                    .stroke(AtharTheme.divider.opacity(0.85), lineWidth: 1)
            }
            .shadow(color: AtharTheme.ink.opacity(0.045), radius: 16, y: 8)
    }
}

extension View {
    func atharCard(padding: CGFloat = 18, background: Color = AtharTheme.surface) -> some View {
        modifier(CardStyle(padding: padding, background: background))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var tint: Color = AtharTheme.forest

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.athar(17, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 18)
            .background(tint.opacity(configuration.isPressed ? 0.78 : 1))
            .clipShape(RoundedRectangle(cornerRadius: AtharTheme.buttonRadius, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

struct CompactPill: View {
    let symbol: String
    let text: String
    var tint: Color = AtharTheme.forest

    var body: some View {
        Label(text, systemImage: symbol)
            .font(.athar(13, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(tint.opacity(0.1))
            .clipShape(Capsule())
    }
}

struct AtharProgressBar: View {
    let value: Double
    var tint: Color = AtharTheme.emerald
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(tint.opacity(0.14))
                Capsule()
                    .fill(tint)
                    .frame(width: proxy.size.width * min(max(value, 0), 1))
            }
        }
        .frame(height: height)
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: value)
    }
}

struct SectionHeading: View {
    let title: String
    var subtitle: String? = nil
    var trailing: AnyView? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.athar(21, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                }
            }
            Spacer()
            trailing
        }
    }
}

extension Decimal {
    var sarFormatted: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ar_SA")
        formatter.maximumFractionDigits = 0
        return "\(formatter.string(from: NSDecimalNumber(decimal: self)) ?? "0") ر.س"
    }
}
