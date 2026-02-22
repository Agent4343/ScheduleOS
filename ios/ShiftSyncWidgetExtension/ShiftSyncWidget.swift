import WidgetKit
import SwiftUI

// MARK: - Widget Timeline Provider
struct ShiftSyncProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShiftSyncEntry {
        ShiftSyncEntry(
            date: Date(),
            currentShift: "Day Shift",
            shiftIcon: "sun.max.fill",
            shiftColor: .orange,
            nextShift: "Night Shift",
            nextShiftTime: "6:00 PM",
            crewName: "Crew A",
            daysOnRemaining: 5,
            totalDaysOn: 14,
            onDutyCount: 12,
            alertCount: 0
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ShiftSyncEntry) -> Void) {
        let entry = ShiftSyncEntry(
            date: Date(),
            currentShift: "Day Shift",
            shiftIcon: "sun.max.fill",
            shiftColor: .orange,
            nextShift: "Night Shift",
            nextShiftTime: "6:00 PM",
            crewName: "Crew A",
            daysOnRemaining: 5,
            totalDaysOn: 14,
            onDutyCount: 12,
            alertCount: 2
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftSyncEntry>) -> Void) {
        // Fetch current shift data from shared UserDefaults (app group)
        let defaults = UserDefaults(suiteName: "group.com.shiftsync.app")

        let currentShift = defaults?.string(forKey: "widget_currentShift") ?? "Off"
        let shiftIcon = defaults?.string(forKey: "widget_shiftIcon") ?? "house.fill"
        let nextShift = defaults?.string(forKey: "widget_nextShift") ?? "--"
        let nextShiftTime = defaults?.string(forKey: "widget_nextShiftTime") ?? "--"
        let crewName = defaults?.string(forKey: "widget_crewName") ?? "N/A"
        let daysOnRemaining = defaults?.integer(forKey: "widget_daysOnRemaining") ?? 0
        let totalDaysOn = defaults?.integer(forKey: "widget_totalDaysOn") ?? 0
        let onDutyCount = defaults?.integer(forKey: "widget_onDutyCount") ?? 0
        let alertCount = defaults?.integer(forKey: "widget_alertCount") ?? 0

        let shiftColor: Color
        switch currentShift {
        case "Day Shift": shiftColor = .orange
        case "Night Shift": shiftColor = .indigo
        case "Off": shiftColor = .gray
        default: shiftColor = .blue
        }

        let entry = ShiftSyncEntry(
            date: Date(),
            currentShift: currentShift,
            shiftIcon: shiftIcon,
            shiftColor: shiftColor,
            nextShift: nextShift,
            nextShiftTime: nextShiftTime,
            crewName: crewName,
            daysOnRemaining: daysOnRemaining,
            totalDaysOn: totalDaysOn,
            onDutyCount: onDutyCount,
            alertCount: alertCount
        )

        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Widget Entry
struct ShiftSyncEntry: TimelineEntry {
    let date: Date
    let currentShift: String
    let shiftIcon: String
    let shiftColor: Color
    let nextShift: String
    let nextShiftTime: String
    let crewName: String
    let daysOnRemaining: Int
    let totalDaysOn: Int
    let onDutyCount: Int
    let alertCount: Int
}

// MARK: - Small Widget View
struct ShiftSyncWidgetSmallView: View {
    let entry: ShiftSyncEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(hex: "2563EB"))
                Text("ShiftSync")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(hex: "2563EB"))
                Spacer()
                if entry.alertCount > 0 {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 11))
                        .foregroundColor(.orange)
                }
            }

            Spacer()

            // Current shift
            HStack(spacing: 6) {
                Image(systemName: entry.shiftIcon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(entry.shiftColor)
                Text(entry.currentShift)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
            }

            // Crew
            Text(entry.crewName)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)

            // Progress bar for rotation
            if entry.totalDaysOn > 0 {
                VStack(alignment: .leading, spacing: 2) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color(.systemGray5))
                                .frame(height: 6)

                            RoundedRectangle(cornerRadius: 3)
                                .fill(entry.shiftColor)
                                .frame(
                                    width: geo.size.width * CGFloat(entry.totalDaysOn - entry.daysOnRemaining) / CGFloat(entry.totalDaysOn),
                                    height: 6
                                )
                        }
                    }
                    .frame(height: 6)

                    Text("\(entry.daysOnRemaining) days remaining")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(14)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Medium Widget View
struct ShiftSyncWidgetMediumView: View {
    let entry: ShiftSyncEntry

    var body: some View {
        HStack(spacing: 16) {
            // Left side - current shift
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: "2563EB"))
                    Text("ShiftSync")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(hex: "2563EB"))
                }

                Spacer()

                HStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .fill(entry.shiftColor.opacity(0.2))
                            .frame(width: 44, height: 44)
                        Image(systemName: entry.shiftIcon)
                            .font(.system(size: 22, weight: .medium))
                            .foregroundColor(entry.shiftColor)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.currentShift)
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                        Text(entry.crewName)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }

                // Rotation progress
                if entry.totalDaysOn > 0 {
                    VStack(alignment: .leading, spacing: 3) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color(.systemGray5))
                                    .frame(height: 6)
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(entry.shiftColor)
                                    .frame(
                                        width: geo.size.width * CGFloat(entry.totalDaysOn - entry.daysOnRemaining) / CGFloat(entry.totalDaysOn),
                                        height: 6
                                    )
                            }
                        }
                        .frame(height: 6)

                        Text("\(entry.daysOnRemaining) of \(entry.totalDaysOn) days remaining")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }
            }

            Divider()

            // Right side - stats
            VStack(alignment: .leading, spacing: 12) {
                StatRow(icon: "arrow.right.circle.fill", label: "Next", value: entry.nextShift, color: .blue)
                StatRow(icon: "clock.fill", label: "Starts", value: entry.nextShiftTime, color: .green)
                StatRow(icon: "person.3.fill", label: "On Duty", value: "\(entry.onDutyCount)", color: .purple)

                if entry.alertCount > 0 {
                    StatRow(
                        icon: "exclamationmark.triangle.fill",
                        label: "Alerts",
                        value: "\(entry.alertCount)",
                        color: .orange
                    )
                }
            }
        }
        .padding(14)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct StatRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(color)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 0) {
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.secondary)
                Text(value)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Widget Configuration
struct ShiftSyncWidget: Widget {
    let kind: String = "ShiftSyncWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShiftSyncProvider()) { entry in
            if #available(iOS 17.0, *) {
                ShiftSyncWidgetEntryView(entry: entry)
            } else {
                ShiftSyncWidgetEntryView(entry: entry)
                    .padding()
            }
        }
        .configurationDisplayName("ShiftSync")
        .description("View your current shift, rotation progress, and team status at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ShiftSyncWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: ShiftSyncEntry

    var body: some View {
        switch family {
        case .systemSmall:
            ShiftSyncWidgetSmallView(entry: entry)
        case .systemMedium:
            ShiftSyncWidgetMediumView(entry: entry)
        default:
            ShiftSyncWidgetSmallView(entry: entry)
        }
    }
}

// MARK: - Widget Bundle
@main
struct ShiftSyncWidgetBundle: WidgetBundle {
    var body: some Widget {
        ShiftSyncWidget()
    }
}

// MARK: - Color Extension (widget needs its own)
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: Double(a) / 255)
    }
}

// MARK: - Previews
#Preview(as: .systemSmall) {
    ShiftSyncWidget()
} timeline: {
    ShiftSyncEntry(
        date: Date(),
        currentShift: "Day Shift",
        shiftIcon: "sun.max.fill",
        shiftColor: .orange,
        nextShift: "Night Shift",
        nextShiftTime: "6:00 PM",
        crewName: "Crew A",
        daysOnRemaining: 5,
        totalDaysOn: 14,
        onDutyCount: 12,
        alertCount: 2
    )
}

#Preview(as: .systemMedium) {
    ShiftSyncWidget()
} timeline: {
    ShiftSyncEntry(
        date: Date(),
        currentShift: "Night Shift",
        shiftIcon: "moon.stars.fill",
        shiftColor: .indigo,
        nextShift: "Off",
        nextShiftTime: "6:00 AM",
        crewName: "Crew B",
        daysOnRemaining: 2,
        totalDaysOn: 14,
        onDutyCount: 8,
        alertCount: 1
    )
}
