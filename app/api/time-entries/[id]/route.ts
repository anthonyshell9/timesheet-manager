import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAuth,
  validateRequest,
  errorResponse,
  forbiddenResponse,
} from '@/lib/api-utils';
import { timeEntryUpdateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
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
        timesheet: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!entry) {
      return notFoundResponse('Entrée de temps');
    }

    // Check access
    if (entry.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    return successResponse(entry);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const existingEntry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        timesheet: {
          select: { status: true },
        },
      },
    });

    if (!existingEntry) {
      return notFoundResponse('Entrée de temps');
    }

    // Check ownership
    if (existingEntry.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    // Check if timesheet is locked
    if (
      existingEntry.timesheet &&
      ['APPROVED', 'REJECTED'].includes(existingEntry.timesheet.status)
    ) {
      return errorResponse(
        'Impossible de modifier une entrée dans une feuille de temps verrouillée',
        403
      );
    }

    const { data, error: validationError } = await validateRequest(request, timeEntryUpdateSchema);
    if (validationError) return validationError;

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
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

    // Update timesheet total hours if it exists
    if (existingEntry.timesheetId) {
      const totalMinutes = await prisma.timeEntry.aggregate({
        where: { timesheetId: existingEntry.timesheetId },
        _sum: { duration: true },
      });

      await prisma.timeSheet.update({
        where: { id: existingEntry.timesheetId },
        data: { totalHours: (totalMinutes._sum.duration || 0) / 60 },
      });
    }

    await logCrudOperation('UPDATE', 'TimeEntry', entry.id, {
      oldValues: existingEntry,
      newValues: data,
    });

    return successResponse(entry);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const entry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        timesheet: {
          select: { id: true, status: true },
        },
      },
    });

    if (!entry) {
      return notFoundResponse('Entrée de temps');
    }

    // Check ownership
    if (entry.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    // Check if timesheet is locked
    if (entry.timesheet && ['APPROVED', 'REJECTED'].includes(entry.timesheet.status)) {
      return errorResponse(
        'Impossible de supprimer une entrée dans une feuille de temps verrouillée',
        403
      );
    }

    await prisma.timeEntry.delete({
      where: { id },
    });

    // Update timesheet total hours
    if (entry.timesheetId) {
      const totalMinutes = await prisma.timeEntry.aggregate({
        where: { timesheetId: entry.timesheetId },
        _sum: { duration: true },
      });

      await prisma.timeSheet.update({
        where: { id: entry.timesheetId },
        data: { totalHours: (totalMinutes._sum.duration || 0) / 60 },
      });
    }

    await logCrudOperation('DELETE', 'TimeEntry', id);

    return successResponse({ message: 'Entrée supprimée' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
