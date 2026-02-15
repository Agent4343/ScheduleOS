import SwiftUI
import WebKit

// MARK: - WebView Container (SwiftUI wrapper)
struct WebViewContainer: View {
    let path: String
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @StateObject private var viewModel = WebViewModel()
    @State private var showErrorPage = false

    var body: some View {
        ZStack {
            ShiftSyncWebViewRepresentable(
                serverURL: appState.serverURL,
                path: path,
                viewModel: viewModel,
                onNavigationEvent: handleNavigationEvent
            )
            .opacity(viewModel.isLoading && !viewModel.hasLoadedOnce ? 0 : 1)

            // Loading state
            if viewModel.isLoading && !viewModel.hasLoadedOnce {
                ShimmerLoadingView()
                    .transition(.opacity)
            }

            // Progress bar at top
            if viewModel.isLoading {
                VStack {
                    GeometryReader { geo in
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [ThemeManager.Colors.brandPrimary, ThemeManager.Colors.brandSecondary],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geo.size.width * viewModel.estimatedProgress, height: 3)
                            .animation(.easeInOut(duration: 0.3), value: viewModel.estimatedProgress)
                    }
                    .frame(height: 3)
                    Spacer()
                }
            }

            // Error state
            if let error = viewModel.error, !networkMonitor.isConnected || showErrorPage {
                ErrorStateView(error: error) {
                    viewModel.reload()
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: viewModel.isLoading)
    }

    private func handleNavigationEvent(_ event: WebNavigationEvent) {
        switch event {
        case .logout:
            appState.logout()
        case .navigate(let newPath):
            // Map web paths to native tabs
            if let tab = TabItem.allCases.first(where: { $0.webPath == newPath }) {
                appState.selectedTab = tab
            }
        case .badgeUpdate(let counts):
            appState.badgeCounts = counts
        case .hapticFeedback(let style):
            HapticManager.shared.impact(style: style)
        }
    }
}

// MARK: - Navigation Events
enum WebNavigationEvent {
    case logout
    case navigate(String)
    case badgeUpdate(BadgeCounts)
    case hapticFeedback(UIImpactFeedbackGenerator.FeedbackStyle)
}

// MARK: - WebView ViewModel
class WebViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var estimatedProgress: Double = 0
    @Published var hasLoadedOnce = false
    @Published var error: WebViewError?
    @Published var canGoBack = false
    @Published var canGoForward = false

    weak var webView: WKWebView?

    func reload() {
        error = nil
        webView?.reload()
    }

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }
}

enum WebViewError: Error, LocalizedError {
    case networkError
    case serverError(Int)
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .networkError:
            return "Unable to connect to the server"
        case .serverError(let code):
            return "Server error (HTTP \(code))"
        case .unknown(let message):
            return message
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .networkError:
            return "Check your internet connection and try again."
        case .serverError:
            return "The server may be temporarily unavailable. Try again later."
        case .unknown:
            return "An unexpected error occurred. Try reloading the page."
        }
    }

    var icon: String {
        switch self {
        case .networkError: return "wifi.exclamationmark"
        case .serverError: return "exclamationmark.icloud"
        case .unknown: return "exclamationmark.triangle"
        }
    }
}

// MARK: - WKWebView UIViewRepresentable
struct ShiftSyncWebViewRepresentable: UIViewRepresentable {
    let serverURL: String
    let path: String
    let viewModel: WebViewModel
    let onNavigationEvent: (WebNavigationEvent) -> Void

    func makeCoordinator() -> WebViewCoordinator {
        WebViewCoordinator(viewModel: viewModel, onNavigationEvent: onNavigationEvent)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Enable JavaScript
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        config.defaultWebpagePreferences = preferences

        // Setup user content controller for JS bridge
        let contentController = WKUserContentController()

        // Inject ShiftSync native bridge JavaScript
        let bridgeScript = WKUserScript(
            source: ShiftSyncJSBridge.bridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(bridgeScript)

        // Inject CSS overrides for native feel
        let cssScript = WKUserScript(
            source: ShiftSyncJSBridge.nativeCSSOverrides,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        contentController.addUserScript(cssScript)

        // Register message handlers
        contentController.add(context.coordinator, name: "shiftSyncBridge")
        contentController.add(context.coordinator, name: "shiftSyncNavigation")
        contentController.add(context.coordinator, name: "shiftSyncHaptic")

        config.userContentController = contentController

        // Configure data store for persistent sessions
        config.websiteDataStore = .default()

        // Allow inline media playback
        config.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground

        // Pull-to-refresh
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(WebViewCoordinator.handleRefresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl

        // Store reference
        viewModel.webView = webView

        // Observe loading progress
        context.coordinator.observeProgress(webView)

        // Sync cookies from HTTPCookieStorage to WKWebView before loading
        let urlString = "\(serverURL)\(path)"
        if let pageURL = URL(string: urlString),
           let host = URL(string: serverURL)?.host {
            let cookies = HTTPCookieStorage.shared.cookies?.filter {
                $0.domain.contains(host) || host.contains($0.domain)
            } ?? []

            if cookies.isEmpty {
                let request = URLRequest(url: pageURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15)
                webView.load(request)
            } else {
                let cookieStore = config.websiteDataStore.httpCookieStore
                let group = DispatchGroup()
                for cookie in cookies {
                    group.enter()
                    cookieStore.setCookie(cookie) { group.leave() }
                }
                group.notify(queue: .main) {
                    let request = URLRequest(url: pageURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15)
                    webView.load(request)
                }
            }
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Only reload if path changed significantly
    }
}

// MARK: - WebView Coordinator
class WebViewCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let viewModel: WebViewModel
    let onNavigationEvent: (WebNavigationEvent) -> Void
    private var progressObservation: NSKeyValueObservation?
    private var loadingObservation: NSKeyValueObservation?

    init(viewModel: WebViewModel, onNavigationEvent: @escaping (WebNavigationEvent) -> Void) {
        self.viewModel = viewModel
        self.onNavigationEvent = onNavigationEvent
    }

    func observeProgress(_ webView: WKWebView) {
        progressObservation = webView.observe(\.estimatedProgress) { [weak self] webView, _ in
            DispatchQueue.main.async {
                self?.viewModel.estimatedProgress = webView.estimatedProgress
            }
        }
        loadingObservation = webView.observe(\.isLoading) { [weak self] webView, _ in
            DispatchQueue.main.async {
                self?.viewModel.isLoading = webView.isLoading
                self?.viewModel.canGoBack = webView.canGoBack
                self?.viewModel.canGoForward = webView.canGoForward
            }
        }
    }

    @objc func handleRefresh(_ refreshControl: UIRefreshControl) {
        viewModel.webView?.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            refreshControl.endRefreshing()
        }
        HapticManager.shared.impact(style: .light)
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        DispatchQueue.main.async {
            self.viewModel.isLoading = true
            self.viewModel.error = nil
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DispatchQueue.main.async {
            self.viewModel.isLoading = false
            self.viewModel.hasLoadedOnce = true
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleError(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleError(error)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // Open external links in Safari
        if let host = url.host,
           let serverHost = URL(string: viewModel.webView?.url?.absoluteString ?? "")?.host,
           host != serverHost {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        switch message.name {
        case "shiftSyncBridge":
            handleBridgeMessage(message.body)
        case "shiftSyncNavigation":
            if let path = message.body as? String {
                DispatchQueue.main.async {
                    self.onNavigationEvent(.navigate(path))
                }
            }
        case "shiftSyncHaptic":
            if let style = message.body as? String {
                let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle
                switch style {
                case "heavy": feedbackStyle = .heavy
                case "medium": feedbackStyle = .medium
                default: feedbackStyle = .light
                }
                onNavigationEvent(.hapticFeedback(feedbackStyle))
            }
        default:
            break
        }
    }

    // MARK: - WKUIDelegate
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // Open target="_blank" links in the same webview
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    // MARK: - Helpers
    private func handleError(_ error: Error) {
        DispatchQueue.main.async {
            self.viewModel.isLoading = false
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                self.viewModel.error = .networkError
            } else {
                self.viewModel.error = .unknown(error.localizedDescription)
            }
        }
    }

    private func handleBridgeMessage(_ body: Any) {
        guard let dict = body as? [String: Any],
              let action = dict["action"] as? String else { return }

        DispatchQueue.main.async {
            switch action {
            case "logout":
                self.onNavigationEvent(.logout)
            case "badgeUpdate":
                if let data = dict["data"] as? [String: Int] {
                    let counts = BadgeCounts(
                        pendingTimeOff: data["pendingTimeOff"] ?? 0,
                        notifications: data["notifications"] ?? 0,
                        staffingAlerts: data["staffingAlerts"] ?? 0
                    )
                    self.onNavigationEvent(.badgeUpdate(counts))
                }
            default:
                break
            }
        }
    }
}

// MARK: - JS Bridge Scripts
struct ShiftSyncJSBridge {
    static let bridgeScript = """
    // ShiftSync Native Bridge
    window.ShiftSyncNative = {
        isNativeApp: true,
        platform: 'ios',
        version: '\(AppConfig.appVersion)',

        // Send message to native app
        postMessage: function(action, data) {
            window.webkit.messageHandlers.shiftSyncBridge.postMessage({
                action: action,
                data: data
            });
        },

        // Navigation
        navigate: function(path) {
            window.webkit.messageHandlers.shiftSyncNavigation.postMessage(path);
        },

        // Haptic feedback
        haptic: function(style) {
            window.webkit.messageHandlers.shiftSyncHaptic.postMessage(style || 'light');
        },

        // Logout
        logout: function() {
            this.postMessage('logout', {});
        },

        // Update badge counts
        updateBadges: function(counts) {
            this.postMessage('badgeUpdate', counts);
        }
    };

    // Notify web app that native bridge is ready
    document.addEventListener('DOMContentLoaded', function() {
        window.dispatchEvent(new CustomEvent('shiftSyncNativeReady', {
            detail: { platform: 'ios' }
        }));
    });
    """

    static let nativeCSSOverrides = """
    (function() {
        var style = document.createElement('style');
        style.textContent = `
            /* Hide web app header/nav when in native shell */
            [data-native-hide="true"],
            .web-only-header,
            .web-only-footer,
            .web-only-nav {
                display: none !important;
            }

            /* Adjust padding for native safe areas */
            body {
                -webkit-overflow-scrolling: touch;
            }

            /* Smooth scrolling for native feel */
            * {
                -webkit-tap-highlight-color: transparent;
            }

            /* Ensure proper input rendering */
            input, textarea, select {
                font-size: 16px !important; /* Prevents iOS zoom on focus */
            }

            /* Native-style selection */
            ::selection {
                background: rgba(37, 99, 235, 0.3);
            }
        `;
        document.head.appendChild(style);
    })();
    """
}

// MARK: - Shimmer Loading View
struct ShimmerLoadingView: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 20) {
            // Header shimmer
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemGray5))
                .frame(height: 60)
                .shimmer(isAnimating: isAnimating)

            // Stat cards shimmer
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.systemGray5))
                        .frame(height: 100)
                        .shimmer(isAnimating: isAnimating)
                }
            }

            // Content blocks shimmer
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemGray5))
                    .frame(height: 70)
                    .shimmer(isAnimating: isAnimating)
            }

            Spacer()
        }
        .padding(16)
        .onAppear {
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                isAnimating = true
            }
        }
    }
}

// MARK: - Shimmer Modifier
struct ShimmerModifier: ViewModifier {
    let isAnimating: Bool

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [
                            .clear,
                            .white.opacity(0.4),
                            .clear
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.6)
                    .offset(x: isAnimating ? geo.size.width : -geo.size.width)
                }
                .clipped()
            )
    }
}

extension View {
    func shimmer(isAnimating: Bool) -> some View {
        modifier(ShimmerModifier(isAnimating: isAnimating))
    }
}

// MARK: - Error State View
struct ErrorStateView: View {
    let error: WebViewError
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: error.icon)
                .font(.system(size: 56, weight: .light))
                .foregroundColor(.secondary)

            VStack(spacing: 8) {
                Text(error.localizedDescription)
                    .font(.system(size: 20, weight: .semibold))
                    .multilineTextAlignment(.center)

                if let suggestion = error.recoverySuggestion {
                    Text(suggestion)
                        .font(.system(size: 15))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }

            Button(action: {
                HapticManager.shared.impact(style: .medium)
                onRetry()
            }) {
                Label("Try Again", systemImage: "arrow.clockwise")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 12)
                    .background(ThemeManager.Colors.brandPrimary)
                    .clipShape(Capsule())
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}
