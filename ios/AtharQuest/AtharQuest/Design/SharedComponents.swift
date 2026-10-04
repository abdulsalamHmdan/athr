import SwiftUI
import UIKit

struct PageHeader: View {
    let title: String
    let subtitle: String
    var symbol: String? = nil

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.system(size: 21, weight: .bold))
                    .foregroundStyle(AtharTheme.forest)
                    .frame(width: 46, height: 46)
                    .background(AtharTheme.mint)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.athar(28, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text(subtitle)
                    .font(.athar(14))
                    .foregroundStyle(AtharTheme.secondaryText)
            }
            Spacer()
        }
    }
}

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(AtharTheme.emerald)
                .frame(width: 76, height: 76)
                .background(AtharTheme.mint)
                .clipShape(Circle())
            Text(title)
                .font(.athar(20, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
            Text(message)
                .font(.athar(14))
                .multilineTextAlignment(.center)
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .atharCard()
    }
}

struct LoadingStateView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(AtharTheme.forest)
                .scaleEffect(1.15)
            Text("نجهّز تجربتك…")
                .font(.athar(16, weight: .semibold))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtharTheme.pageBackground)
    }
}

struct ErrorStateView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 38, weight: .semibold))
                .foregroundStyle(AtharTheme.coral)
            Text("تعذّر تحميل الحساب")
                .font(.athar(22, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
            Text(message)
                .font(.athar(14))
                .multilineTextAlignment(.center)
                .foregroundStyle(AtharTheme.secondaryText)
            Button("إعادة المحاولة", action: retry)
                .buttonStyle(PrimaryButtonStyle())
                .frame(maxWidth: 260)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AtharTheme.pageBackground)
    }
}

struct ToastOverlay: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "checkmark.circle.fill")
            .font(.athar(14, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 13)
            .background(AtharTheme.ink.opacity(0.94))
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.16), radius: 14, y: 8)
            .padding(.horizontal, 18)
            .accessibilityAddTraits(.isStaticText)
    }
}

struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    let completion: (Bool, String?) -> Void

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { activityType, completed, _, _ in
            completion(completed, activityType?.rawValue)
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) { }
}

struct BalanceBadge: View {
    let value: Int
    let label: String
    let symbol: String
    var tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(tint)
            Text(value.formatted(.number.locale(Locale(identifier: "ar_SA"))))
                .font(.athar(23, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
                .contentTransition(.numericText())
            Text(label)
                .font(.athar(12, weight: .medium))
                .foregroundStyle(AtharTheme.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .atharCard(padding: 15)
    }
}
