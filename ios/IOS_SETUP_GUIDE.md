# ShiftSync iOS App - Setup & App Store Submission Guide

## Overview

The ShiftSync iOS app is a native SwiftUI wrapper around the ShiftSync web application. It provides a polished, native iOS experience with:

- **Native tab bar navigation** with 5 main sections
- **Face ID / Touch ID** authentication
- **Push notifications** for shift reminders, time-off approvals, and staffing alerts
- **Home screen widgets** showing current shift, rotation progress, and team status
- **Offline mode detection** with user-friendly banners
- **Haptic feedback** throughout the UI
- **Pull-to-refresh** on all web views
- **Deep linking** via `shiftsync://` URL scheme and Universal Links
- **Native splash screen** with animated branding
- **4-page onboarding** flow for first-time users

## Requirements

- **Xcode 15.4+**
- **iOS 17.0+** deployment target
- **macOS Sonoma 14.0+** (for development)
- **Apple Developer Account** ($99/year for App Store distribution)
- **ShiftSync server** deployed and accessible (e.g., on Railway)

## Project Structure

```
ios/
├── ShiftSync.xcodeproj/          # Xcode project
│   ├── project.pbxproj           # Project configuration
│   └── xcshareddata/xcschemes/   # Shared schemes
├── ShiftSync/                    # Main app target
│   ├── ShiftSyncApp.swift        # App entry point + AppDelegate
│   ├── Info.plist                # App configuration & permissions
│   ├── ShiftSync.entitlements    # Capabilities (push, keychain, app groups)
│   ├── Models/
│   │   └── AppState.swift        # App state, data models, configuration
│   ├── Views/
│   │   ├── RootView.swift        # Root view with splash + routing
│   │   ├── OnboardingView.swift  # 4-page onboarding with server config
│   │   ├── LoginView.swift       # Native login with biometric support
│   │   └── MainTabView.swift     # Tab bar + all tab views + settings
│   ├── WebView/
│   │   └── ShiftSyncWebView.swift # WKWebView bridge with JS interop
│   ├── Services/
│   │   ├── AuthenticationManager.swift  # Auth + biometric login
│   │   ├── KeychainService.swift        # Secure credential storage
│   │   ├── NetworkMonitor.swift         # Connectivity monitoring
│   │   ├── HapticManager.swift          # Haptic feedback engine
│   │   ├── NotificationService.swift    # Push + local notifications
│   │   └── ThemeManager.swift           # Theme + brand colors
│   ├── Assets.xcassets/          # App icon, colors, images
│   └── Preview Content/          # SwiftUI previews
├── ShiftSyncWidgetExtension/     # Home screen widget
│   ├── ShiftSyncWidget.swift     # Widget views (small + medium)
│   └── Info.plist
├── ShiftSyncTests/               # Unit tests
│   └── ShiftSyncTests.swift
├── ExportOptions.plist           # App Store export config
├── Fastfile                      # Fastlane automation
└── Gemfile                       # Ruby dependencies
```

## Quick Start

### 1. Open in Xcode

```bash
cd ios
open ShiftSync.xcodeproj
```

### 2. Configure Your Server URL

Edit `ShiftSync/Models/AppState.swift` and update:

```swift
struct AppConfig {
    static let defaultServerURL = "https://your-server.railway.app"
    // ...
}
```

### 3. Configure Signing

1. In Xcode, select the **ShiftSync** target
2. Go to **Signing & Capabilities**
3. Select your **Team** (Apple Developer account)
4. The bundle identifier is `com.shiftsync.app` — change if needed

### 4. Add App Icon

Replace the placeholder in `Assets.xcassets/AppIcon.appiconset/` with your 1024x1024 app icon. You can use tools like [AppIcon.co](https://appicon.co) to generate all required sizes.

### 5. Run on Simulator or Device

- Select a simulator (iPhone 15 Pro recommended)
- Press `Cmd + R` to build and run

## App Store Submission

### Step 1: Apple Developer Account Setup

1. Go to [developer.apple.com](https://developer.apple.com)
2. Enroll in the Apple Developer Program ($99/year)
3. Create an **App ID** with these capabilities:
   - Push Notifications
   - Associated Domains
   - App Groups (`group.com.shiftsync.app`)
   - Keychain Sharing

### Step 2: App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Create a new app:
   - **Name**: ShiftSync
   - **Bundle ID**: `com.shiftsync.app`
   - **SKU**: `shiftsync-ios-1`
   - **Primary Language**: English (US)
   - **Category**: Business

### Step 3: App Store Metadata

Fill in the required fields:

**Promotional Text:**
> AI-powered workforce scheduling for complex rotating shifts.

**Description:**
> ShiftSync is the intelligent workforce scheduling platform built for industries with complex rotation patterns — offshore oil & gas, manufacturing, healthcare, and construction.
>
> KEY FEATURES:
> • Smart Scheduling — AI-powered rotation management for 2on/2off through 21on/21off patterns and custom rotations
> • Crew Management — Organize workers into crews with automatic phase offsets and day/night transitions
> • Time-Off Requests — Submit, track, and approve vacation, sick leave, and personal time requests
> • Staffing Alerts — Real-time notifications when minimum staffing levels are at risk
> • Home Screen Widget — View your current shift and rotation progress at a glance
> • Secure Authentication — Face ID and Touch ID for quick, secure access
> • Offline Awareness — Stay informed even when connectivity is limited
>
> Built for supervisors, administrators, and workers who need reliable shift management.

**Keywords:**
> shift scheduling, workforce management, crew rotation, employee scheduling, offshore scheduling, rotating shifts, time off management

**Support URL:** `https://shiftsync.up.railway.app/support`
**Privacy Policy URL:** `https://shiftsync.up.railway.app/privacy`

### Step 4: Screenshots

Generate screenshots using the Fastlane screenshots lane or take them manually:

```bash
cd ios
bundle exec fastlane screenshots
```

Required sizes:
- **6.7" iPhone** (iPhone 15 Pro Max): 1290 x 2796
- **6.5" iPhone** (iPhone 14 Plus): 1284 x 2778
- **5.5" iPhone** (iPhone 8 Plus): 1242 x 2208
- **12.9" iPad Pro**: 2048 x 2732

### Step 5: Build & Upload

**Using Fastlane (recommended):**

```bash
cd ios
bundle install
bundle exec fastlane beta     # Upload to TestFlight
bundle exec fastlane release  # Submit to App Store
```

**Using Xcode:**

1. Select **Product > Archive**
2. In Organizer, click **Distribute App**
3. Choose **App Store Connect**
4. Upload

### Step 6: App Review

Apple typically reviews apps within 24-48 hours. Common review items to prepare for:

- Ensure your server is running and accessible
- Have a demo account ready (provide login credentials in App Review notes)
- Privacy policy must be live and accessible
- All described features must be functional

**App Review Notes (provide in App Store Connect):**
```
Demo Account:
Email: demo@shiftsync.app
Password: demo123456

The app connects to our cloud server at https://shiftsync.up.railway.app.
Please ensure you have an internet connection during testing.
```

## Push Notifications Setup

### 1. Create APNs Key

1. Go to [developer.apple.com/account/resources/authkeys](https://developer.apple.com/account/resources/authkeys)
2. Create a new key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` file and note the Key ID

### 2. Configure Server

Add these environment variables to your ShiftSync server:

```env
APNS_KEY_ID=your_key_id
APNS_TEAM_ID=your_team_id
APNS_KEY_PATH=path/to/AuthKey.p8
APNS_BUNDLE_ID=com.shiftsync.app
```

## Universal Links

To enable Universal Links (opening web URLs directly in the app):

1. Add an `apple-app-site-association` file to your web server's `.well-known` directory:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.shiftsync.app",
        "paths": ["/dashboard/*", "/schedule/*", "/crews/*", "/time-off/*"]
      }
    ]
  }
}
```

2. The entitlements file already includes `applinks:shiftsync.up.railway.app`

## Customization

### Changing Brand Colors

Edit `Services/ThemeManager.swift`:

```swift
struct Colors {
    static let brandPrimary = Color(hex: "YOUR_COLOR")
    static let brandSecondary = Color(hex: "YOUR_COLOR")
}
```

Also update the color sets in `Assets.xcassets/Colors/`.

### Adding Native Screens

To replace a web view tab with a fully native screen:

1. Create a new SwiftUI view in `Views/`
2. Replace the `WebViewContainer` in `MainTabView.swift` with your native view
3. Use the API service to fetch data directly

### Widget Data

The widget reads from shared `UserDefaults` (app group: `group.com.shiftsync.app`). Update widget data from the main app:

```swift
let defaults = UserDefaults(suiteName: "group.com.shiftsync.app")
defaults?.set("Day Shift", forKey: "widget_currentShift")
WidgetCenter.shared.reloadAllTimelines()
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| WebView shows blank | Check `AppConfig.defaultServerURL` is correct and server is running |
| Face ID not working | Ensure `NSFaceIDUsageDescription` is in Info.plist |
| Push notifications not received | Verify APNs key, team ID, and bundle ID configuration |
| Widget not updating | Check app group entitlement matches between app and widget targets |
| Build fails on device | Ensure signing team is configured in Xcode |

## Architecture Decisions

- **WKWebView + Native Shell**: Provides the full web app functionality while adding native iOS features (biometrics, widgets, push, haptics)
- **SwiftUI**: Modern declarative UI framework for native components
- **Keychain**: Secure credential storage for biometric re-authentication
- **App Groups**: Shared data between main app and widget extension
- **No third-party dependencies**: Pure Apple frameworks for minimal maintenance burden
