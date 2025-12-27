import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAuth,
  forbiddenResponse,
  errorResponse,
} from '@/lib/api-utils';
import { logCrudOperation } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const timesheet = await prisma.timeSheet.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        lockedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        timeEntries: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
              },
            },
            subProject: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        },
        approvals: {
          include: {
            validator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!timesheet) {
      return notFoundResponse('Feuille de temps');
    }

    // Check access
    const isOwner = timesheet.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';
    const isValidator = session.user.role === 'VALIDATOR';

    // Check if user is a validator for any project in this timesheet
    let canValidate = false;
    if (isValidator && !isOwner) {
      const projectIds = [...new Set(timesheet.timeEntries.map((e) => e.projectId))];
      const validatorCheck = await prisma.projectValidator.findFirst({
        where: {
          userId: session.user.id,
          projectId: { in: projectIds },
        },
      });
      canValidate = !!validatorCheck;
    }

    if (!isOwner && !isAdmin && !canValidate) {
      return forbiddenResponse();
    }

    // Group entries by date
    const entriesByDate: Record<string, typeof timesheet.timeEntries> = {};
    timesheet.timeEntries.forEach((entry) => {
      const dateKey = entry.date.toISOString().split('T')[0]!;
      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = [];
      }
      entriesByDate[dateKey].push(entry);
    });

    // Calculate totals by project
    const totalsByProject: Record<string, { name: string; minutes: number }> = {};
    timesheet.timeEntries.forEach((entry) => {
      let projectTotal = totalsByProject[entry.projectId];
      if (!projectTotal) {
        projectTotal = {
          name: entry.project.name,
          minutes: 0,
        };
        totalsByProject[entry.projectId] = projectTotal;
      }
      projectTotal.minutes += entry.duration;
    });

    return successResponse({
      ...timesheet,
      entriesByDate,
      totalsByProject,
      canValidate,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const timesheet = await prisma.timeSheet.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        _count: {
          select: { timeEntries: true },
        },
      },
    });

    if (!timesheet) {
      return notFoundResponse('Feuille de temps');
    }

    // Only owner can delete their own timesheet
    if (timesheet.userId !== session.user.id) {
      return forbiddenResponse();
    }

    // Can only delete DRAFT or REOPENED timesheets
    if (!['DRAFT', 'REOPENED'].includes(timesheet.status)) {
      return errorResponse(
        'Impossible de supprimer une feuille de temps déjà soumise',
        400
      );
    }

    // Delete associated time entries first
    await prisma.timeEntry.deleteMany({
      where: { timesheetId: id },
    });

    // Delete associated approvals
    await prisma.approval.deleteMany({
      where: { timesheetId: id },
    });

    // Delete the timesheet
    await prisma.timeSheet.delete({
      where: { id },
    });

    await logCrudOperation('DELETE', 'TimeSheet', id);

    return successResponse({ message: 'Feuille de temps supprimée' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
