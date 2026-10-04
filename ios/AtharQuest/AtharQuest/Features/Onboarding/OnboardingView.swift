import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var model: AppModel
    @State private var step = 0
    @State private var name = ""
    @State private var selectedStyle: PlayStyle = .calm

    var body: some View {
        ZStack {
            AtharTheme.pageBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(spacing: 7) {
                    ForEach(0..<3, id: \.self) { index in
                        Capsule()
                            .fill(index <= step ? AtharTheme.forest : AtharTheme.divider)
                            .frame(width: index == step ? 34 : 10, height: 8)
                    }
                    Spacer()
                    if model.isDemoMode {
                        CompactPill(symbol: "sparkles", text: "نسخة تجريبية")
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 10)

                TabView(selection: $step) {
                    welcomePage.tag(0)
                    stylePage.tag(1)
                    identityPage.tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: step)

                Button(step == 2 ? "ابدأ رحلتك" : "متابعة") {
                    if step < 2 {
                        withAnimation { step += 1 }
                    } else {
                        model.finishOnboarding(name: name, playStyle: selectedStyle)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, 22)
                .padding(.bottom, 12)
            }
        }
        .onAppear {
            name = model.profile?.name ?? ""
            selectedStyle = model.profile?.playStyle ?? .calm
        }
    }

    private var welcomePage: some View {
        VStack(spacing: 24) {
            ZStack {
                RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: "3F237C"), Color(hex: "7658CE")],
                            startPoint: .topTrailing,
                            endPoint: .bottomLeading
                        )
                    )

                Circle()
                    .fill(.white.opacity(0.08))
                    .frame(width: 190, height: 190)
                    .offset(x: -115, y: -90)

                VStack(spacing: 19) {
                    HStack(spacing: 22) {
                        Image(systemName: "questionmark")
                            .font(.system(size: 23, weight: .bold))
                            .foregroundStyle(.white.opacity(0.72))
                            .rotationEffect(.degrees(-10))

                        Image(systemName: "trophy.fill")
                            .font(.system(size: 86, weight: .bold))
                            .foregroundStyle(AtharTheme.gold)

                        Image(systemName: "bolt.fill")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(.white.opacity(0.72))
                            .rotationEffect(.degrees(10))
                    }

                    Label("٥٠٬٠٠٠ نقطة كل جمعة", systemImage: "seal.fill")
                        .font(.athar(17, weight: .bold))
                        .foregroundStyle(Color(hex: "3F237C"))
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(.white)
                        .clipShape(Capsule())
                }
            }
            .frame(height: 290)
                .padding(.top, 20)
                .padding(.horizontal, 20)

            VStack(spacing: 10) {
                Text("تحدَّ، تعلَّم، واصنع أثرًا")
                    .font(.athar(32, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("نافس في أسئلة قرآنية مباشرة، ثم حوّل حماسك إلى نشر وصناديق تساند الجمعية.")
                    .font(.athar(17))
                    .foregroundStyle(AtharTheme.secondaryText)
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
            }
            .padding(.horizontal, 28)
            Spacer()
        }
    }

    private var stylePage: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                Text("كيف تحب أن تلعب؟")
                    .font(.athar(30, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("لا نطلب عمرك؛ اختر التجربة الأنسب لك ويمكن تغييرها لاحقًا.")
                    .font(.athar(16))
                    .foregroundStyle(AtharTheme.secondaryText)
                    .lineSpacing(4)
            }

            ForEach(PlayStyle.allCases) { style in
                Button {
                    selectedStyle = style
                    AtharHaptics.tap(enabled: model.profile?.hapticsEnabled ?? true)
                } label: {
                    HStack(spacing: 16) {
                        Image(systemName: style == .calm ? "leaf.fill" : "bolt.fill")
                            .font(.system(size: 23, weight: .bold))
                            .foregroundStyle(style == .calm ? AtharTheme.emerald : AtharTheme.gold)
                            .frame(width: 54, height: 54)
                            .background((style == .calm ? AtharTheme.emerald : AtharTheme.gold).opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))

                        VStack(alignment: .leading, spacing: 4) {
                            Text(style.title)
                                .font(.athar(19, weight: .bold))
                                .foregroundStyle(AtharTheme.ink)
                            Text(style.subtitle)
                                .font(.athar(14))
                                .foregroundStyle(AtharTheme.secondaryText)
                        }
                        Spacer()
                        Image(systemName: selectedStyle == style ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 23, weight: .semibold))
                            .foregroundStyle(selectedStyle == style ? AtharTheme.forest : AtharTheme.divider)
                    }
                    .atharCard(background: selectedStyle == style ? AtharTheme.paleMint : .white)
                }
                .buttonStyle(.plain)
            }

            VStack(alignment: .leading, spacing: 10) {
                Label("أسئلة قرآنية بأربع إجابات", systemImage: "questionmark.bubble.fill")
                Label("نقاط أعلى للإجابة الصحيحة الأسرع", systemImage: "bolt.fill")
                Label("خط عربي واضح ودعم VoiceOver", systemImage: "textformat.size")
                Label("لا توجد صناديق حظ أو شراء للنقاط", systemImage: "checkmark.shield.fill")
            }
            .font(.athar(14, weight: .semibold))
            .foregroundStyle(AtharTheme.secondaryText)
            .padding(.horizontal, 4)
            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 42)
    }

    private var identityPage: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text("أهلًا بك يا سفير الأثر")
                    .font(.athar(30, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text("يظهر الاسم داخل التطبيق فقط في هذه النسخة التجريبية.")
                    .font(.athar(16))
                    .foregroundStyle(AtharTheme.secondaryText)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("الاسم")
                    .font(.athar(14, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                TextField("اكتب اسمك", text: $name)
                    .font(.athar(18, weight: .semibold))
                    .textContentType(.name)
                    .padding(17)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(AtharTheme.divider, lineWidth: 1)
                    }
            }

            HStack(spacing: 14) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AtharTheme.forest)
                Text("عند الربط الحقيقي سيكون الدخول بنفس حساب السفير الحالي، والتبرعات لا تُحتسب إلا من الخادم.")
                    .font(.athar(14))
                    .foregroundStyle(AtharTheme.secondaryText)
                    .lineSpacing(3)
            }
            .atharCard(background: AtharTheme.paleMint)

            Spacer()
        }
        .padding(.horizontal, 22)
        .padding(.top, 52)
    }
}
