import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showResetConfirmation = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                if let profile = model.profile {
                    VStack(spacing: 12) {
                        Text(profile.avatarInitials)
                            .font(.athar(34, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 88, height: 88)
                            .background(AtharTheme.forest)
                            .clipShape(Circle())
                        Text(profile.name)
                            .font(.athar(25, weight: .bold))
                            .foregroundStyle(AtharTheme.ink)
                        CompactPill(symbol: "sparkles", text: "المستوى \(profile.level)")
                        AtharProgressBar(value: profile.levelProgress)
                            .frame(maxWidth: 220)
                    }
                    .padding(.vertical, 12)

                    VStack(alignment: .leading, spacing: 14) {
                        Text("أسلوب اللعب")
                            .font(.athar(19, weight: .bold))
                            .foregroundStyle(AtharTheme.ink)
                        ForEach(PlayStyle.allCases) { style in
                            Button {
                                model.setPlayStyle(style)
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: style == .calm ? "leaf.fill" : "bolt.fill")
                                        .foregroundStyle(style == .calm ? AtharTheme.emerald : AtharTheme.gold)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(style.title).font(.athar(16, weight: .bold))
                                        Text(style.subtitle).font(.athar(12))
                                    }
                                    .foregroundStyle(AtharTheme.ink)
                                    Spacer()
                                    Image(systemName: profile.playStyle == style ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(profile.playStyle == style ? AtharTheme.forest : AtharTheme.divider)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .atharCard()

                    VStack(spacing: 0) {
                        Toggle(isOn: Binding(
                            get: { model.profile?.hapticsEnabled ?? true },
                            set: { model.setHaptics($0) }
                        )) {
                            Label("الاهتزازات اللمسية", systemImage: "hand.tap.fill")
                                .font(.athar(16, weight: .semibold))
                        }
                        .padding(.vertical, 12)
                        Divider()
                        Toggle(isOn: Binding(
                            get: { model.profile?.soundEnabled ?? true },
                            set: { model.setSound($0) }
                        )) {
                            Label("المؤثرات الصوتية", systemImage: "speaker.wave.2.fill")
                                .font(.athar(16, weight: .semibold))
                        }
                        .padding(.vertical, 12)
                    }
                    .atharCard()

                    VStack(alignment: .leading, spacing: 10) {
                        Label("النقاط الحقيقية محمية", systemImage: "lock.shield.fill")
                            .font(.athar(17, weight: .bold))
                            .foregroundStyle(AtharTheme.ink)
                        Text("لا يستطيع التطبيق إضافة نقاط استبدال من اللعب وحده. التبرعات والإنجازات المؤهلة تُحسب وتُوقّع من الخادم.")
                            .font(.athar(13))
                            .foregroundStyle(AtharTheme.secondaryText)
                            .lineSpacing(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .atharCard(background: AtharTheme.paleMint)

                    if !model.isDemoMode {
                        if let config = model.configuration {
                            if let url = URL(string: config.supportURL), url.scheme == "https" { Link("التواصل مع الدعم", destination: url) }
                            if let url = URL(string: config.privacyURL), url.scheme == "https" { Link("سياسة الخصوصية", destination: url) }
                            if let url = URL(string: config.termsURL), url.scheme == "https" { Link("الشروط والأحكام", destination: url) }
                        }
                        Button("تسجيل الخروج", role: .destructive) { Task { await model.logout() } }
                    }
                    if model.isDemoMode {
                        Button(role: .destructive) {
                            showResetConfirmation = true
                        } label: {
                            Label("إعادة التجربة من البداية", systemImage: "arrow.counterclockwise")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .padding(18)
        }
        .background(AtharTheme.pageBackground)
        .navigationTitle("الملف الشخصي")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "هل تريد حذف تقدّم النسخة التجريبية؟",
            isPresented: $showResetConfirmation,
            titleVisibility: .visible
        ) {
            Button("إعادة من البداية", role: .destructive) { model.resetDemo() }
            Button("إلغاء", role: .cancel) { }
        }
    }
}
