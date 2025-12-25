import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  createdResponse,
  serverErrorResponse,
  requireAuth,
  validateRequest,
  errorResponse,
  getPagination,
  createPaginationMeta,
} from '@/lib/api-utils';
import { timeEntryCreateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';
import { addDays, startOfWeek } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');

    // Regular users can only see their own entries
    const targetUserId =
      session.user.role === 'ADMIN' && userId ? userId : session.user.id;

    const where = {
      userId: targetUserId,
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
      ...(projectId && { projectId }),
    };

    const [entries, total] = await Promise.all([
      prisma.timeEntry.findMany({
        where,
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          duration: true,
          description: true,
          isBillable: true,
          isTimerEntry: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
              hourlyRate: true,
            },
          },
          subProject: {
            select: {
              id: true,
              name: true,
            },
          },
          timesheet: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        ...getPagination(page, limit),
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      }),
      prisma.timeEntry.count({ where }),
    ]);

    return successResponse(entries, createPaginationMeta(page, limit, total));
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(
      request,
      timeEntryCreateSchema
    );
    if (validationError) return validationError;

    // Get or create timesheet for this week
    const entryDate = new Date(data.date);
    const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    let timesheet = await prisma.timeSheet.findUnique({
      where: {
        userId_weekStart: {
          userId: session.user.id,
          weekStart,
        },
      },
    });

    if (!timesheet) {
      timesheet = await prisma.timeSheet.create({
        data: {
          userId: session.user.id,
          weekStart,
          weekEnd,
          status: 'DRAFT',
        },
      });
    }

    // Check if timesheet is locked
    if (['APPROVED', 'REJECTED'].includes(timesheet.status)) {
      return errorResponse(
        'Impossible de modifier une feuille de temps verrouillée',
        403
      );
    }

    // Create the time entry
    const entry = await prisma.timeEntry.create({
      data: {
        userId: session.user.id,
        projectId: data.projectId,
        subProjectId: data.subProjectId,
        timesheetId: timesheet.id,
        date: entryDate,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        description: data.description,
        isBillable: data.isBillable,
        isTimerEntry: data.isTimerEntry,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        duration: true,
        description: true,
        isBillable: true,
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subProject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update timesheet total hours
    const totalMinutes = await prisma.timeEntry.aggregate({
      where: { timesheetId: timesheet.id },
      _sum: { duration: true },
    });

    await prisma.timeSheet.update({
      where: { id: timesheet.id },
      data: { totalHours: (totalMinutes._sum.duration || 0) / 60 },
    });

    await logCrudOperation('CREATE', 'TimeEntry', entry.id, {
      newValues: data,
    });

    return createdResponse(entry);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
