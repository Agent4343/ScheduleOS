/**
 * Sync API - Receives changes from desktop app and applies to cloud database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface SyncPayload {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  data: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is supervisor or admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload: SyncPayload = await request.json();

    // Apply the change based on table and action
    switch (payload.table) {
      case 'schedules':
        await syncSchedule(payload, user.organizationId!);
        break;
      case 'time_off_requests':
        await syncTimeOffRequest(payload);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported table: ${payload.table}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function syncSchedule(payload: SyncPayload, organizationId: string) {
  const { action, data } = payload;

  // Verify the user belongs to this organization
  if (data.userId) {
    const worker = await prisma.user.findFirst({
      where: {
        id: data.userId as string,
        organizationId,
      },
    });

    if (!worker) {
      throw new Error('Worker not found in organization');
    }
  }

  switch (action) {
    case 'INSERT':
    case 'UPDATE':
      await prisma.schedule.upsert({
        where: {
          userId_date: {
            userId: data.userId as string,
            date: new Date(data.date as string),
          },
        },
        create: {
          id: data.id as string,
          userId: data.userId as string,
          date: new Date(data.date as string),
          shiftType: data.shiftType as string,
          isOverride: data.isOverride as boolean || false,
          overrideReason: data.overrideReason as string | null,
          notes: data.notes as string | null,
          isBackfill: data.isBackfill as boolean || false,
          backfillRole: data.backfillRole as string | null,
          crewId: data.crewId as string | null,
        },
        update: {
          shiftType: data.shiftType as string,
          isOverride: data.isOverride as boolean || false,
          overrideReason: data.overrideReason as string | null,
          notes: data.notes as string | null,
          isBackfill: data.isBackfill as boolean || false,
          backfillRole: data.backfillRole as string | null,
          crewId: data.crewId as string | null,
        },
      });
      break;

    case 'DELETE':
      await prisma.schedule.deleteMany({
        where: {
          userId: data.userId as string,
          date: new Date(data.date as string),
        },
      });
      break;
  }
}

async function syncTimeOffRequest(payload: SyncPayload) {
  const { action, data } = payload;

  switch (action) {
    case 'UPDATE':
      // Only allow status updates from desktop
      if (data.status) {
        await prisma.timeOffRequest.update({
          where: { id: payload.recordId },
          data: {
            status: data.status as 'APPROVED' | 'DENIED' | 'PENDING' | 'CANCELLED',
            approvedById: data.approvedById as string | null,
            approvedAt: data.approvedAt ? new Date(data.approvedAt as string) : null,
          },
        });
      }
      break;

    default:
      throw new Error(`Action ${action} not supported for time_off_requests from desktop`);
  }
}
