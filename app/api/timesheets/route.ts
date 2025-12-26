import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  createdResponse,
  serverErrorResponse,
  requireAuth,
  getPagination,
  createPaginationMeta,
} from '@/lib/api-utils';
import { logCrudOperation } from '@/lib/audit';

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
          name: true,
          periodStart: true,
          periodEnd: true,
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
        orderBy: { createdAt: 'desc' },
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

    // Get optional name from body
    let name: string | undefined;
    try {
      const body = await request.json();
      name = body.name;
    } catch {
      // No body or invalid JSON
    }

    // Check if user already has a DRAFT timesheet
    const existing = await prisma.timeSheet.findFirst({
      where: {
        userId: session.user.id,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return successResponse(existing);
    }

    const timesheet = await prisma.timeSheet.create({
      data: {
        userId: session.user.id,
        name,
        status: 'DRAFT',
      },
      select: {
        id: true,
        name: true,
        periodStart: true,
        periodEnd: true,
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
