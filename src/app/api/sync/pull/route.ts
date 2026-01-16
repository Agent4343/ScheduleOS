/**
 * Sync Pull API - Sends data to desktop app for local storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    if (!user.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    // Build date filter if "since" is provided
    const dateFilter = since ? { updatedAt: { gte: new Date(since) } } : {};

    // Fetch all relevant data for the organization
    const [users, crews, rotationPatterns, positions, schedules, timeOffRequests] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          ...dateFilter,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          status: true,
          rotationGroup: true,
          primaryPosition: true,
          isCCRQualified: true,
          isPSCapable: true,
          isPLCapable: true,
          organizationId: true,
          crewId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.crew.findMany({
        where: {
          organizationId: user.organizationId,
          ...dateFilter,
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          color: true,
          currentPhase: true,
          alternatesDayNight: true,
          organizationId: true,
          rotationPatternId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.rotationPattern.findMany({
        where: {
          organizationId: user.organizationId,
          ...dateFilter,
        },
        select: {
          id: true,
          name: true,
          description: true,
          daysOn: true,
          daysOff: true,
          includesNights: true,
          nightsAtStart: true,
          nightDays: true,
          alternatesDayNight: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.position.findMany({
        where: {
          organizationId: user.organizationId,
          ...dateFilter,
        },
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          shiftType: true,
          minStaffing: true,
          maxStaffing: true,
          requiredQualifications: true,
          sortOrder: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // Get schedules for the next 6 months
      prisma.schedule.findMany({
        where: {
          user: {
            organizationId: user.organizationId,
          },
          date: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            lte: new Date(new Date().setMonth(new Date().getMonth() + 6)),
          },
          ...(since ? { updatedAt: { gte: new Date(since) } } : {}),
        },
        select: {
          id: true,
          date: true,
          shiftType: true,
          isOverride: true,
          overrideReason: true,
          notes: true,
          isBackfill: true,
          backfillRole: true,
          userId: true,
          crewId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.timeOffRequest.findMany({
        where: {
          user: {
            organizationId: user.organizationId,
          },
          ...dateFilter,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          type: true,
          status: true,
          reason: true,
          notes: true,
          userId: true,
          approvedById: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      users,
      crews,
      rotationPatterns,
      positions,
      schedules,
      timeOffRequests,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: String(error) },
      { status: 500 }
    );
  }
}
