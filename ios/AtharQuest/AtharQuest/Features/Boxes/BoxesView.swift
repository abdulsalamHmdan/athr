import SwiftUI

struct BoxesView: View {
    @EnvironmentObject private var model: AppModel
    @State private var showingCreateBox = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                PageHeader(
                    title: "صناديق الأثر",
                    subtitle: "فرص تذكارية بأسماء من نحب",
                    symbol: "gift.fill"
                )

                Button {
                    showingCreateBox = true
                } label: {
                    Label("إنشاء صندوق جديد", systemImage: "plus.circle.fill")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!model.isDemoMode && model.configuration?.boxesEnabled != true)

                if model.boxes.isEmpty {
                    EmptyStateView(
                        symbol: "gift.fill",
                        title: "ابدأ أول صندوق",
                        message: "سمّه باسم متوفى، حدّد هدفه، ثم شارك رابطه مع معارفك."
                    )
                } else {
                    ForEach(model.boxes) { box in
                        BoxCard(box: box)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .refreshable { await model.refresh() }
        .background(AtharTheme.pageBackground)
        .navigationBarHidden(true)
        .sheet(isPresented: $showingCreateBox) {
            CreateBoxView()
                .environmentObject(model)
                .environment(\.layoutDirection, .rightToLeft)
        }
    }
}

private struct BoxCard: View {
    @EnvironmentObject private var model: AppModel
    let box: MemorialOpportunity

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .top, spacing: 13) {
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AtharTheme.forest)
                    .frame(width: 52, height: 52)
                    .background(AtharTheme.mint)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(box.title)
                        .font(.athar(18, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                        .lineLimit(2)
                    Text("\(box.donors) مساهمًا")
                        .font(.athar(13, weight: .medium))
                        .foregroundStyle(AtharTheme.secondaryText)
                }
                Spacer()
                HStack(spacing: 5) {
                    Circle()
                        .fill(stateColor)
                        .frame(width: 8, height: 8)
                    Text(box.state.title)
                        .font(.athar(10, weight: .bold))
                        .foregroundStyle(stateColor)
                }
                .padding(.top, 7)
            }

            AtharProgressBar(value: box.progressFraction)
            HStack {
                Text(box.raised.sarFormatted)
                    .font(.athar(17, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Spacer()
                Text("الهدف \(box.target.sarFormatted)")
                    .font(.athar(13, weight: .semibold))
                    .foregroundStyle(AtharTheme.secondaryText)
            }

            Button {
                model.startShare(
                    url: box.shareURL,
                    message: "صدقة جارية عن \(box.deceasedName) — ساهم بما تيسّر وانشر الأجر.",
                    resourceID: box.id
                )
            } label: {
                Label("مشاركة الصندوق", systemImage: "paperplane.fill")
            }
            .buttonStyle(PrimaryButtonStyle(tint: AtharTheme.emerald))
            .disabled(!box.isShareable)
            .opacity(box.isShareable ? 1 : 0.55)
        }
        .atharCard()
    }

    private var stateColor: Color {
        switch box.state {
        case .active: AtharTheme.emerald
        case .pendingReview: AtharTheme.gold
        case .completed: Color(hex: "5775C5")
        case .paused: AtharTheme.secondaryText
        }
    }
}

private struct CreateBoxView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var deceasedName = ""
    @State private var title = ""
    @State private var target = 3_000
    @State private var didEditTitle = false

    private let presets = [1_000, 3_000, 5_000, 10_000]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("أنشئ أثرًا باسم من تحب")
                            .font(.athar(26, weight: .bold))
                            .foregroundStyle(AtharTheme.ink)
                        Text("يُرسل الطلب للمراجعة. يتاح رابط الصندوق بعد اعتماده وربطه بمنصة التبرع.")
                            .font(.athar(14))
                            .foregroundStyle(AtharTheme.secondaryText)
                            .lineSpacing(3)
                    }

                    field(title: "اسم المتوفى") {
                        TextField("مثال: محمد بن عبدالله", text: $deceasedName)
                            .textContentType(.name)
                            .onChange(of: deceasedName) { _, newValue in
                                if !didEditTitle {
                                    title = newValue.isEmpty ? "" : "صدقة جارية عن \(newValue)"
                                }
                            }
                    }

                    field(title: "عنوان الصندوق") {
                        TextField(
                            "عنوان يظهر للمتبرع",
                            text: Binding(
                                get: { title },
                                set: {
                                    title = $0
                                    didEditTitle = true
                                }
                            )
                        )
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("المستهدف")
                            .font(.athar(14, weight: .bold))
                            .foregroundStyle(AtharTheme.ink)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 9) {
                            ForEach(presets, id: \.self) { value in
                                Button {
                                    target = value
                                } label: {
                                    Text("\(value.formatted()) ر.س")
                                        .font(.athar(14, weight: .bold))
                                        .foregroundStyle(target == value ? .white : AtharTheme.ink)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(target == value ? AtharTheme.forest : .white)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    Button {
                        Task {
                            let success = await model.createBox(
                                name: deceasedName,
                                title: title,
                                target: Decimal(target)
                            )
                            if success { dismiss() }
                        }
                    } label: {
                        if model.isCreatingBox {
                            ProgressView().tint(.white)
                        } else {
                            Text("إنشاء الصندوق")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(
                        deceasedName.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 ||
                        title.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 ||
                        model.isCreatingBox
                    )
                    .opacity(deceasedName.count < 3 || title.count < 5 ? 0.5 : 1)
                }
                .padding(20)
            }
            .background(AtharTheme.pageBackground)
            .navigationTitle("صندوق جديد")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("إغلاق") { dismiss() }
                }
            }
        }
    }

    private func field<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(title)
                .font(.athar(14, weight: .bold))
                .foregroundStyle(AtharTheme.ink)
            content()
                .font(.athar(16, weight: .medium))
                .padding(16)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 17, style: .continuous)
                        .stroke(AtharTheme.divider, lineWidth: 1)
                }
        }
    }
}
