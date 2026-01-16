/**
 * Schedule Import API
 * Uploads Excel file and applies schedule changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { parse, isValid, format } from 'date-fns';

// Valid shift types
const VALID_SHIFT_TYPES = new Set([
  'DAY', 'NIGHT', 'PS', 'PL', 'CCR', 'CCR-T',
  'A-PS', 'A-PL', 'B-CCR',
  'TRAIN', 'SAFETY',
  'VAC', 'SICK', 'PTO', 'LWOP', 'JURY', 'BRV', 'HOL',
  'OFF', 'SHUTDOWN',
]);

interface ScheduleChange {
  userId: string;
  userName: string;
  date: string;
  oldShift: string | null;
  newShift: string | null;
}

interface ImportPreview {
  changes: ScheduleChange[];
  errors: string[];
  summary: {
    totalChanges: number;
    additions: number;
    modifications: number;
    deletions: number;
  };
}

// POST: Preview changes from uploaded Excel
export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const applyChanges = formData.get('apply') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Read Excel file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get Schedule sheet
    const scheduleSheet = workbook.Sheets['Schedule'];
    if (!scheduleSheet) {
      return NextResponse.json({ error: 'Schedule sheet not found' }, { status: 400 });
    }

    // Parse sheet to JSON
    const data = XLSX.utils.sheet_to_json<string[]>(scheduleSheet, { header: 1 });

    if (data.length < 2) {
      return NextResponse.json({ error: 'No data found in schedule sheet' }, { status: 400 });
    }

    // Parse headers (first row)
    const headers = data[0] as string[];
    const dateColumns: { index: number; date: Date }[] = [];

    // Find date columns (starting from column 5, index 4)
    for (let i = 4; i < headers.length; i++) {
      const headerText = headers[i];
      if (!headerText) continue;

      // Parse date from header like "Mon 01/15"
      // Try multiple formats
      const currentYear = new Date().getFullYear();
      const dateStr = headerText.replace(/^[A-Za-z]+\s*/, ''); // Remove day name

      let parsedDate = parse(`${dateStr}/${currentYear}`, 'MM/dd/yyyy', new Date());
      if (!isValid(parsedDate)) {
        parsedDate = parse(`${dateStr}/${currentYear}`, 'M/dd/yyyy', new Date());
      }
      if (!isValid(parsedDate)) {
        parsedDate = parse(`${dateStr}/${currentYear}`, 'MM/d/yyyy', new Date());
      }
      if (!isValid(parsedDate)) {
        parsedDate = parse(`${dateStr}/${currentYear}`, 'M/d/yyyy', new Date());
      }

      if (isValid(parsedDate)) {
        dateColumns.push({ index: i, date: parsedDate });
      }
    }

    if (dateColumns.length === 0) {
      return NextResponse.json({ error: 'No valid date columns found' }, { status: 400 });
    }

    // Get date range
    const minDate = dateColumns.reduce((min, col) => col.date < min ? col.date : min, dateColumns[0].date);
    const maxDate = dateColumns.reduce((max, col) => col.date > max ? col.date : max, dateColumns[0].date);

    // Fetch existing schedules
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        user: {
          organizationId: user.organizationId,
        },
        date: {
          gte: minDate,
          lte: maxDate,
        },
      },
      select: {
        userId: true,
        date: true,
        shiftType: true,
      },
    });

    // Create lookup for existing schedules
    const existingMap = new Map<string, string>();
    for (const schedule of existingSchedules) {
      const key = `${schedule.userId}-${format(schedule.date, 'yyyy-MM-dd')}`;
      existingMap.set(key, schedule.shiftType);
    }

    // Get valid user IDs
    const validUsers = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, email: true },
    });
    const validUserIds = new Set(validUsers.map(u => u.id));
    const userNameMap = new Map(validUsers.map(u => [u.id, u.name || u.email]));

    // Parse rows and find changes
    const changes: ScheduleChange[] = [];
    const errors: string[] = [];

    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] as string[];
      if (!row || row.length === 0) continue;

      const userId = row[0];
      const userName = row[1] || '';

      // Validate user ID
      if (!userId || !validUserIds.has(userId)) {
        if (userId) {
          errors.push(`Row ${rowIndex + 1}: Unknown worker ID "${userId}"`);
        }
        continue;
      }

      // Check each date column
      for (const { index, date } of dateColumns) {
        const newShift = (row[index] || '').toString().trim().toUpperCase();
        const dateKey = format(date, 'yyyy-MM-dd');
        const key = `${userId}-${dateKey}`;
        const oldShift = existingMap.get(key) || null;

        // Validate shift type
        if (newShift && !VALID_SHIFT_TYPES.has(newShift)) {
          errors.push(`Row ${rowIndex + 1}, ${format(date, 'MM/dd')}: Invalid shift type "${newShift}"`);
          continue;
        }

        // Check if changed
        const normalizedNew = newShift || null;
        const normalizedOld = oldShift || null;

        if (normalizedNew !== normalizedOld) {
          changes.push({
            userId,
            userName: userNameMap.get(userId) || userName,
            date: dateKey,
            oldShift: normalizedOld,
            newShift: normalizedNew,
          });
        }
      }
    }

    // Calculate summary
    const summary = {
      totalChanges: changes.length,
      additions: changes.filter(c => !c.oldShift && c.newShift).length,
      modifications: changes.filter(c => c.oldShift && c.newShift).length,
      deletions: changes.filter(c => c.oldShift && !c.newShift).length,
    };

    const preview: ImportPreview = { changes, errors, summary };

    // If not applying changes, return preview
    if (!applyChanges) {
      return NextResponse.json(preview);
    }

    // Apply changes
    if (changes.length === 0) {
      return NextResponse.json({ message: 'No changes to apply', preview });
    }

    // Use transaction to apply all changes
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const date = new Date(change.date);

        if (change.newShift) {
          // Upsert schedule
          await tx.schedule.upsert({
            where: {
              userId_date: {
                userId: change.userId,
                date,
              },
            },
            create: {
              userId: change.userId,
              date,
              shiftType: change.newShift,
              isOverride: true,
              overrideReason: 'Excel import',
            },
            update: {
              shiftType: change.newShift,
              isOverride: true,
              overrideReason: 'Excel import',
            },
          });
        } else {
          // Delete schedule
          await tx.schedule.deleteMany({
            where: {
              userId: change.userId,
              date,
            },
          });
        }
      }
    });

    return NextResponse.json({
      message: `Successfully applied ${changes.length} changes`,
      preview,
    });
  } catch (error) {
    console.error('Schedule import error:', error);
    return NextResponse.json(
      { error: 'Failed to import schedule', details: String(error) },
      { status: 500 }
    );
  }
}
