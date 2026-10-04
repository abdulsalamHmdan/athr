import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack(alignment: .top) {
            Group {
                if !model.isDemoMode, let config = model.configuration, !config.enabled {
                    VStack(spacing: 20) {
                        Image(systemName: "leaf.circle.fill").font(.system(size: 64)).foregroundStyle(AtharTheme.forest)
                        Text("أثر").font(.largeTitle.bold())
                        Text(config.maintenanceMessage).multilineTextAlignment(.center)
                        Button("تحديث") { Task { await model.retryBootstrap() } }.buttonStyle(.borderedProminent)
                    }.padding(28)
                } else if model.needsLogin {
                    AtharLoginView()
                } else if model.isLoading && model.profile == nil {
                    LoadingStateView()
                } else if let error = model.errorMessage, model.profile == nil {
                    ErrorStateView(message: error) {
                        Task { await model.retryBootstrap() }
                    }
                } else if !model.hasCompletedOnboarding {
                    OnboardingView()
                        .transition(.opacity.combined(with: .scale(scale: 0.98)))
                } else {
                    MainTabView()
                        .transition(.opacity)
                }
            }

            if let toast = model.toastMessage {
                ToastOverlay(message: toast)
                    .padding(.top, 12)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(10)
            }
        }
        .animation(.easeInOut(duration: 0.28), value: model.hasCompletedOnboarding)
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: model.toastMessage)
        .task { await model.bootstrap() }
        .onReceive(NotificationCenter.default.publisher(for: .atharSessionExpired)) { _ in
            model.clearSession()
        }
        .onChange(of: model.toastMessage) { _, newValue in
            guard let newValue else { return }
            Task {
                try? await Task.sleep(for: .seconds(2.8))
                if !Task.isCancelled, model.toastMessage == newValue {
                    model.dismissToast()
                }
            }
        }
        .sheet(item: $model.sharePayload) { payload in
            ActivityShareSheet(items: [payload.message, payload.url]) { didComplete, destination in
                Task {
                    await model.completeShare(
                        payload: payload,
                        didComplete: didComplete,
                        destination: destination
                    )
                }
            }
            .ignoresSafeArea()
        }
        .alert(
            "تعذّر إتمام العملية",
            isPresented: Binding(
                get: { model.errorMessage != nil && model.profile != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("حسنًا", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "حاول مرة أخرى.")
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TabView(selection: $model.selectedTab) {
            NavigationStack { HomeView() }
                .tabItem { Label("الرئيسية", systemImage: "house.fill") }
                .tag(AmbassadorTab.home)

            NavigationStack {
                if model.isDemoMode || model.configuration?.missionsEnabled == true { MissionsView() }
                else { FeatureUnavailableView(title: "المهام") }
            }
                .tabItem { Label("المهام", systemImage: "checklist") }
                .tag(AmbassadorTab.missions)

            NavigationStack {
                if model.isDemoMode { CompetitionHubView() }
                else if model.configuration?.competitionsEnabled == true { RemoteCompetitionHubView() }
                else { FeatureUnavailableView(title: "المسابقات") }
            }
                .tabItem { Label("المسابقة", systemImage: "trophy.fill") }
                .tag(AmbassadorTab.game)

            NavigationStack { BoxesView() }
                .tabItem { Label("الصناديق", systemImage: "gift.fill") }
                .tag(AmbassadorTab.boxes)

            NavigationStack {
                if model.isDemoMode || model.configuration?.storeEnabled == true { StoreView() }
                else { FeatureUnavailableView(title: "المتجر") }
            }
                .tabItem { Label("المتجر", systemImage: "bag.fill") }
                .tag(AmbassadorTab.store)
        }
    }
}


struct FeatureUnavailableView: View {
    let title: String
    var body: some View {
        ContentUnavailableView(title, systemImage: "clock", description: Text("هذا القسم غير متاح حاليًا. تابعنا قريبًا."))
    }
}
struct AtharLoginView: View {
    @EnvironmentObject private var model: AppModel
    @State private var phone = ""
    @State private var password = ""
    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                Image(systemName: "leaf.circle.fill").font(.system(size: 80)).foregroundStyle(AtharTheme.forest)
                Text("مرحبًا بك في أثر").font(.athar(28, weight: .bold))
                Text("ادخل بحسابك في منصة نقاط الأثر لتتابع إنجازاتك ومكافآتك.").multilineTextAlignment(.center)
                TextField("رقم الجوال", text: $phone).keyboardType(.phonePad).textContentType(.username).textFieldStyle(.roundedBorder)
                SecureField("كلمة المرور", text: $password).textContentType(.password).textFieldStyle(.roundedBorder)
                if let error = model.errorMessage { Text(error).foregroundStyle(.red).font(.footnote) }
                Button {
                    Task { await model.login(phone: phone, password: password); password = "" }
                } label: {
                    if model.isSigningIn { ProgressView().tint(.white) }
                    else { Text("تسجيل الدخول") }
                }.buttonStyle(PrimaryButtonStyle()).disabled(model.isSigningIn || phone.isEmpty || password.isEmpty)
                if let base = AppEnvironment.apiBaseURL {
                    Link("إنشاء حساب أو استعادة كلمة المرور", destination: base.appending(path: "login"))
                }
                if let config = model.configuration {
                    if let url = URL(string: config.privacyURL), url.scheme == "https" { Link("سياسة الخصوصية", destination: url) }
                    if let url = URL(string: config.termsURL), url.scheme == "https" { Link("الشروط والأحكام", destination: url) }
                }
            }.padding(28).padding(.top, 40)
        }.background(AtharTheme.pageBackground)
    }
}
