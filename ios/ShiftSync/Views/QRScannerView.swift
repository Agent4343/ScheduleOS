import SwiftUI
import AVFoundation

// MARK: - QR Scanner View
struct QRScannerView: View {
    @EnvironmentObject var appState: AppState
    @State private var scannedCode: String?
    @State private var isScanning = true
    @State private var showResult = false
    @State private var resultMessage = ""
    @State private var resultIsSuccess = false
    @State private var isProcessing = false

    var body: some View {
        ZStack {
            // Camera view
            QRCameraView(
                scannedCode: $scannedCode,
                isScanning: $isScanning
            )
            .ignoresSafeArea()

            // Scanning overlay
            VStack {
                Spacer()

                // Scanning frame
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(ThemeManager.Colors.brandPrimary, lineWidth: 3)
                        .frame(width: 250, height: 250)
                        .background(
                            RoundedRectangle(cornerRadius: 20)
                                .fill(.black.opacity(0.1))
                        )

                    // Corner accents
                    ForEach(0..<4, id: \.self) { corner in
                        CornerAccent()
                            .rotationEffect(.degrees(Double(corner) * 90))
                            .offset(
                                x: corner == 0 || corner == 3 ? -115 : 115,
                                y: corner == 0 || corner == 1 ? -115 : 115
                            )
                    }
                }

                Text("Point camera at worker's QR code")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.top, 20)
                    .shadow(radius: 4)

                Spacer()

                // Result banner
                if showResult {
                    HStack(spacing: 10) {
                        Image(systemName: resultIsSuccess ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                            .font(.system(size: 24))
                        Text(resultMessage)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(resultIsSuccess ? Color.green : Color.red)
                    )
                    .padding(.horizontal, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                // Manual entry button
                NavigationLink {
                    WebViewContainer(path: "/attendance/scan")
                        .navigationTitle("Manual Entry")
                        .navigationBarTitleDisplayMode(.inline)
                } label: {
                    Label("Manual Entry", systemImage: "keyboard")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(.ultraThinMaterial)
                        )
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .onChange(of: scannedCode) { _, newValue in
            if let code = newValue {
                handleScan(code)
            }
        }
        .animation(.spring(response: 0.3), value: showResult)
    }

    private func handleScan(_ code: String) {
        guard !isProcessing else { return }
        isProcessing = true
        isScanning = false
        HapticManager.shared.impact(style: .medium)

        // Parse QR code: "shiftsync:checkin:<userId>"
        let userId: String
        if code.hasPrefix("shiftsync:checkin:") {
            userId = String(code.dropFirst("shiftsync:checkin:".count))
        } else {
            userId = code
        }

        // Try check-in first
        checkIn(userId: userId)
    }

    private func checkIn(userId: String) {
        guard let url = URL(string: "\(appState.serverURL)/api/attendance") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = ["userId": userId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, _, error in
            DispatchQueue.main.async {
                if let error = error {
                    showResultBanner(message: "Network error: \(error.localizedDescription)", success: false)
                    return
                }

                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    showResultBanner(message: "Invalid response", success: false)
                    return
                }

                if json["success"] as? Bool == true {
                    let msg = json["message"] as? String ?? "Checked in successfully"
                    showResultBanner(message: msg, success: true)
                    HapticManager.shared.notification(type: .success)
                } else if let errorMsg = json["error"] as? String,
                          errorMsg.contains("Already") {
                    // Already checked in, try check-out instead
                    checkOut(userId: userId)
                } else {
                    let errorMsg = json["error"] as? String ?? "Check-in failed"
                    showResultBanner(message: errorMsg, success: false)
                    HapticManager.shared.notification(type: .error)
                }
            }
        }.resume()
    }

    private func checkOut(userId: String) {
        guard let url = URL(string: "\(appState.serverURL)/api/attendance/check-out") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = ["userId": userId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, _, error in
            DispatchQueue.main.async {
                if let error = error {
                    showResultBanner(message: "Network error: \(error.localizedDescription)", success: false)
                    return
                }

                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    showResultBanner(message: "Invalid response", success: false)
                    return
                }

                if json["success"] as? Bool == true {
                    let msg = json["message"] as? String ?? "Checked out successfully"
                    showResultBanner(message: msg, success: true)
                    HapticManager.shared.notification(type: .success)
                } else {
                    let errorMsg = json["error"] as? String ?? "Check-out failed"
                    showResultBanner(message: errorMsg, success: false)
                    HapticManager.shared.notification(type: .error)
                }
            }
        }.resume()
    }

    private func showResultBanner(message: String, success: Bool) {
        resultMessage = message
        resultIsSuccess = success
        showResult = true
        isProcessing = false

        // Resume scanning after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            showResult = false
            scannedCode = nil
            isScanning = true
        }
    }
}

// MARK: - Corner Accent
struct CornerAccent: View {
    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: 20))
            path.addLine(to: CGPoint(x: 0, y: 5))
            path.addQuadCurve(to: CGPoint(x: 5, y: 0), control: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 20, y: 0))
        }
        .stroke(ThemeManager.Colors.brandPrimary, lineWidth: 4)
        .frame(width: 20, height: 20)
    }
}

// MARK: - Camera UIViewRepresentable
struct QRCameraView: UIViewRepresentable {
    @Binding var scannedCode: String?
    @Binding var isScanning: Bool

    func makeCoordinator() -> QRCameraCoordinator {
        QRCameraCoordinator(scannedCode: $scannedCode, isScanning: $isScanning)
    }

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.backgroundColor = .black

        let captureSession = AVCaptureSession()
        context.coordinator.captureSession = captureSession

        guard let videoCaptureDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            return view
        }

        guard let videoInput = try? AVCaptureDeviceInput(device: videoCaptureDevice) else {
            return view
        }

        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        }

        let metadataOutput = AVCaptureMetadataOutput()
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            metadataOutput.setMetadataObjectsDelegate(context.coordinator, queue: .main)
            metadataOutput.metadataObjectTypes = [.qr, .code128, .ean13, .ean8, .pdf417]
        }

        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        context.coordinator.previewLayer = previewLayer

        DispatchQueue.global(qos: .userInitiated).async {
            captureSession.startRunning()
        }

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.previewLayer?.frame = uiView.bounds
    }
}

// MARK: - Camera Coordinator
class QRCameraCoordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
    @Binding var scannedCode: String?
    @Binding var isScanning: Bool
    var captureSession: AVCaptureSession?
    var previewLayer: AVCaptureVideoPreviewLayer?

    init(scannedCode: Binding<String?>, isScanning: Binding<Bool>) {
        _scannedCode = scannedCode
        _isScanning = isScanning
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard isScanning,
              let metadataObject = metadataObjects.first,
              let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject,
              let stringValue = readableObject.stringValue else {
            return
        }

        scannedCode = stringValue
    }
}
