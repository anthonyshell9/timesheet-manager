import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  createdResponse,
  serverErrorResponse,
  requireAuth,
  validateRequest,
  getPagination,
  createPaginationMeta,
} from '@/lib/api-utils';
import { timesheetCreateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';
import { addDays, startOfWeek } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const includeValidating = searchParams.get('includeValidating') === 'true';

    let where: Record<string, unknown> = {};

    // For validators, include timesheets they need to validate
    if (session.user.role === 'VALIDATOR' && includeValidating) {
      const validatingProjects = await prisma.projectValidator.findMany({
        where: { userId: session.user.id },
        select: { projectId: true },
      });
      const projectIds = validatingProjects.map((p) => p.projectId);

      where = {
        OR: [
          { userId: session.user.id },
          {
            AND: [
              { status: 'SUBMITTED' },
              {
                timeEntries: {
                  some: {
                    projectId: { in: projectIds },
                  },
                },
              },
            ],
          },
        ],
      };
    } else if (session.user.role === 'ADMIN' && userId) {
      where = { userId };
    } else if (session.user.role !== 'ADMIN') {
      where = { userId: session.user.id };
    }

    if (status) {
      where.status = status;
    }

    const [timesheets, total] = await Promise.all([
      prisma.timeSheet.findMany({
        where,
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          status: true,
          totalHours: true,
          submittedAt: true,
          lockedAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lockedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              timeEntries: true,
              approvals: true,
            },
          },
        },
        ...getPagination(page, limit),
        orderBy: { weekStart: 'desc' },
      }),
      prisma.timeSheet.count({ where }),
    ]);

    return successResponse(timesheets, createPaginationMeta(page, limit, total));
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
      timesheetCreateSchema
    );
    if (validationError) return validationError;

    const weekStart = startOfWeek(new Date(data.weekStart), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    // Check if timesheet already exists
    const existing = await prisma.timeSheet.findUnique({
      where: {
        userId_weekStart: {
          userId: session.user.id,
          weekStart,
        },
      },
    });

    if (existing) {
      return successResponse(existing);
    }

    const timesheet = await prisma.timeSheet.create({
      data: {
        userId: session.user.id,
        weekStart,
        weekEnd,
        status: 'DRAFT',
      },
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        status: true,
        totalHours: true,
        createdAt: true,
      },
    });

    await logCrudOperation('CREATE', 'TimeSheet', timesheet.id);

    return createdResponse(timesheet);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
