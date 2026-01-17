/**
 * Schedule Export API
 * Downloads schedule as Excel file for offline editing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and verify supervisor/admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!user.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const weeksParam = searchParams.get('weeks') || '4';
    const startDateParam = searchParams.get('startDate');

    const weeks = parseInt(weeksParam, 10);
    const startDate = startDateParam
      ? startOfWeek(parseISO(startDateParam), { weekStartsOn: 0 })
      : startOfWeek(new Date(), { weekStartsOn: 0 });
    const endDate = endOfWeek(addWeeks(startDate, weeks - 1), { weekStartsOn: 0 });

    // Get all dates in range
    const dates = eachDayOfInterval({ start: startDate, end: endDate });

    // Fetch workers
    const workers = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'ACTIVE',
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        position: true,
        primaryPosition: true,
        crewId: true,
        crew: {
          select: { name: true },
        },
      },
    });

    // Fetch schedules
    const schedules = await prisma.schedule.findMany({
      where: {
        user: {
          organizationId: user.organizationId,
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        userId: true,
        date: true,
        shiftType: true,
        notes: true,
      },
    });

    // Create schedule lookup
    const scheduleMap = new Map<string, { shiftType: string; notes: string | null }>();
    for (const schedule of schedules) {
      const key = `${schedule.userId}-${format(schedule.date, 'yyyy-MM-dd')}`;
      scheduleMap.set(key, { shiftType: schedule.shiftType, notes: schedule.notes });
    }

    // Build Excel data
    // Header row: Worker ID (hidden), Name, Crew, Position, then dates
    const headers = [
      'Worker ID',
      'Name',
      'Crew',
      'Position',
      ...dates.map(d => format(d, 'EEE MM/dd')),
    ];

    // Data rows
    const rows = workers.map((worker: typeof workers[number]) => {
      const row: (string | null)[] = [
        worker.id,
        worker.name || worker.email,
        worker.crew?.name || '',
        worker.primaryPosition || worker.position || '',
      ];

      // Add shift for each date
      for (const date of dates) {
        const key = `${worker.id}-${format(date, 'yyyy-MM-dd')}`;
        const schedule = scheduleMap.get(key);
        row.push(schedule?.shiftType || '');
      }

      return row;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Main schedule sheet
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
      { wch: 36 },  // Worker ID (will be hidden)
      { wch: 25 },  // Name
      { wch: 15 },  // Crew
      { wch: 15 },  // Position
      ...dates.map(() => ({ wch: 12 })),  // Date columns
    ];

    // Hide Worker ID column (column A)
    ws['!cols'][0].hidden = true;

    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

    // Add legend sheet
    const legendData = [
      ['Shift Code', 'Description', 'Category'],
      ['DAY', 'Day Shift', 'Field Operations'],
      ['NIGHT', 'Night Shift', 'Field Operations'],
      ['PS', 'Pipeline Supervisor', 'Field Operations'],
      ['PL', 'Pipeline Lead', 'Field Operations'],
      ['CCR', 'Control Room', 'Control Room'],
      ['CCR-T', 'Control Room Training', 'Control Room'],
      ['A-PS', 'Acting Pipeline Supervisor', 'Acting/Backfill'],
      ['A-PL', 'Acting Pipeline Lead', 'Acting/Backfill'],
      ['B-CCR', 'Backfill CCR', 'Acting/Backfill'],
      ['TRAIN', 'Training', 'Training'],
      ['SAFETY', 'Safety Training', 'Training'],
      ['VAC', 'Vacation', 'Time Off'],
      ['SICK', 'Sick Leave', 'Time Off'],
      ['PTO', 'Paid Time Off', 'Time Off'],
      ['LWOP', 'Leave Without Pay', 'Time Off'],
      ['JURY', 'Jury Duty', 'Time Off'],
      ['BRV', 'Bereavement', 'Time Off'],
      ['HOL', 'Holiday', 'Time Off'],
      ['OFF', 'Scheduled Off', 'Off'],
      ['SHUTDOWN', 'Shutdown', 'Special'],
    ];
    const legendWs = XLSX.utils.aoa_to_sheet(legendData);
    legendWs['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, legendWs, 'Legend');

    // Add instructions sheet
    const instructionsData = [
      ['ScheduleOS - Schedule Export/Import Instructions'],
      [''],
      ['HOW TO EDIT:'],
      ['1. Edit shift codes in the Schedule sheet (use codes from Legend sheet)'],
      ['2. Do NOT modify the Worker ID column (column A) - it is hidden but required'],
      ['3. Do NOT add or remove rows - only edit existing shift codes'],
      ['4. Save as .xlsx format'],
      [''],
      ['HOW TO UPLOAD:'],
      ['1. Go to the Schedule page in ScheduleOS'],
      ['2. Click "Upload Schedule" button'],
      ['3. Select this edited file'],
      ['4. Review the changes shown'],
      ['5. Click "Apply Changes" to save'],
      [''],
      ['NOTES:'],
      ['- Leave cell empty for no scheduled shift'],
      ['- Use codes exactly as shown in Legend (case sensitive)'],
      ['- Export date: ' + format(new Date(), 'yyyy-MM-dd HH:mm:ss')],
      ['- Date range: ' + format(startDate, 'MMM d, yyyy') + ' to ' + format(endDate, 'MMM d, yyyy')],
    ];
    const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
    instructionsWs['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    const filename = `schedule_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Schedule export error:', error);
    return NextResponse.json(
      { error: 'Failed to export schedule', details: String(error) },
      { status: 500 }
    );
  }
}
