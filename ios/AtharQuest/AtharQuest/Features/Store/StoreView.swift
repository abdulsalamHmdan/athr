import SwiftUI

struct StoreView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedProduct: RewardProduct?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                PageHeader(
                    title: "متجر المكافآت",
                    subtitle: "استبدل إنجازاتك الموثّقة بمنتجات عينية",
                    symbol: "bag.fill"
                )

                if let profile = model.profile {
                    HStack(spacing: 12) {
                        BalanceBadge(
                            value: profile.rewardPoints,
                            label: "رصيد المتجر",
                            symbol: "seal.fill",
                            tint: AtharTheme.gold
                        )
                        BalanceBadge(
                            value: profile.gameSeeds,
                            label: "نقاط التدريب",
                            symbol: "leaf.fill",
                            tint: AtharTheme.emerald
                        )
                    }
                }

                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(AtharTheme.forest)
                    Text("نقاط التدريب تخص اللعب فقط ولا تشتري منتجات. رصيد المتجر يأتي من حوض المسابقة والأثر الموثق من الخادم.")
                        .font(.athar(13))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .lineSpacing(3)
                }
                .atharCard(background: AtharTheme.paleMint)

                SectionHeading(title: "المنتجات المتاحة", subtitle: model.isDemoMode ? "المخزون تجريبي في هذه النسخة" : "المخزون والأسعار من منصة نقاط الأثر")

                if !model.isDemoMode {
                    NavigationLink { AtharOrdersView() } label: { Label("طلباتي السابقة", systemImage: "shippingbox.fill") }
                    if model.products.isEmpty { Text("لا توجد منتجات متاحة حاليًا").padding() }
                }
                ForEach(model.products) { product in
                    ProductCard(product: product) {
                        model.redemptionReceipt = nil
                        selectedProduct = product
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
        }
        .refreshable { await model.refresh() }
        .background(AtharTheme.pageBackground)
        .navigationBarHidden(true)
        .sheet(item: $selectedProduct) { product in
            RedemptionView(product: product)
                .environmentObject(model)
                .environment(\.layoutDirection, .rightToLeft)
        }
    }
}

private struct ProductCard: View {
    @EnvironmentObject private var model: AppModel
    let product: RewardProduct
    let action: () -> Void

    private var canRedeem: Bool {
        (model.profile?.rewardPoints ?? 0) >= product.pointCost && product.stock > 0
    }

    var body: some View {
        HStack(spacing: 15) {
            Image(systemName: product.symbolName)
                .font(.system(size: 31, weight: .semibold))
                .foregroundStyle(Color(hex: product.tintHex))
                .frame(width: 82, height: 92)
                .background(Color(hex: product.tintHex).opacity(0.11))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text(product.name)
                    .font(.athar(18, weight: .bold))
                    .foregroundStyle(AtharTheme.ink)
                Text(product.detail)
                    .font(.athar(13))
                    .foregroundStyle(AtharTheme.secondaryText)
                    .lineLimit(2)
                HStack {
                    Label("\(product.pointCost)", systemImage: "seal.fill")
                        .font(.athar(14, weight: .bold))
                        .foregroundStyle(AtharTheme.gold)
                    Spacer()
                    Button(product.stock == 0 ? "نفد" : "استبدال", action: action)
                        .font(.athar(13, weight: .bold))
                        .buttonStyle(.borderedProminent)
                        .tint(AtharTheme.forest)
                        .disabled(!canRedeem)
                }
            }
        }
        .atharCard(padding: 14)
    }
}

private struct RedemptionView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let product: RewardProduct
    @State private var shippingAddress = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                Spacer(minLength: 12)

                if let receipt = model.redemptionReceipt, receipt.productID == product.id {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 66, weight: .bold))
                        .foregroundStyle(AtharTheme.emerald)
                    Text("تم طلب المكافأة")
                        .font(.athar(27, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text(receipt.statusText)
                        .font(.athar(16))
                        .foregroundStyle(AtharTheme.secondaryText)
                    VStack(spacing: 10) {
                        receiptRow("رقم الطلب", value: String(receipt.id.prefix(8)).uppercased())
                        receiptRow("النقاط المتبقية", value: "\(receipt.remainingPoints)")
                    }
                    .atharCard()
                    Button("تم") { dismiss() }
                        .buttonStyle(PrimaryButtonStyle())
                } else {
                    Image(systemName: product.symbolName)
                        .font(.system(size: 54, weight: .semibold))
                        .foregroundStyle(Color(hex: product.tintHex))
                        .frame(width: 126, height: 126)
                        .background(Color(hex: product.tintHex).opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                    Text(product.name)
                        .font(.athar(25, weight: .bold))
                        .foregroundStyle(AtharTheme.ink)
                    Text("سيُحجز \(product.pointCost) نقطة حتى اعتماد الطلب. تعاد النقاط إذا رفضت الإدارة الطلب.")
                        .font(.athar(15))
                        .foregroundStyle(AtharTheme.secondaryText)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                    if product.requiresShipping && !model.isDemoMode {
                        TextField("عنوان التوصيل: المدينة، الحي، الشارع، رقم المبنى", text: $shippingAddress, axis: .vertical)
                            .textFieldStyle(.roundedBorder).lineLimit(2...4)
                    }
                    Button {
                        Task { await model.redeem(product, shippingAddress: shippingAddress) }
                    } label: {
                        if model.isRedeeming {
                            ProgressView().tint(.white)
                        } else {
                            Label("تأكيد الاستبدال", systemImage: "seal.fill")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(model.isRedeeming || (!model.isDemoMode && product.requiresShipping && shippingAddress.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty))
                }

                Spacer()
            }
            .padding(22)
            .background(AtharTheme.pageBackground)
            .navigationTitle("الاستبدال")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("إغلاق") { dismiss() }
                }
            }
        }
    }

    private func receiptRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(AtharTheme.secondaryText)
            Spacer()
            Text(value).foregroundStyle(AtharTheme.ink).fontWeight(.bold)
        }
        .font(.athar(14))
    }
}


struct AtharOrdersView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        List {
            if model.orders.isEmpty { Text("لا توجد طلبات سابقة") }
            ForEach(model.orders) { order in
                VStack(alignment: .leading, spacing: 8) {
                    Text(order.productName).font(.headline)
                    Text(order.statusText)
                    Text("\(order.pointsSpent) نقطة • طلب \(order.id.suffix(8))").font(.footnote).foregroundStyle(.secondary)
                }.padding(.vertical, 8)
            }
        }.navigationTitle("طلباتي").task { await model.loadOrders() }.refreshable { await model.loadOrders() }
    }
}
