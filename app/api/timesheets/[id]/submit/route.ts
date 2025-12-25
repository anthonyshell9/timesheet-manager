import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAuth,
  errorResponse,
  forbiddenResponse,
} from '@/lib/api-utils';
import { logWorkflowAction, createTimesheetHash } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const timesheet = await prisma.timeSheet.findUnique({
      where: { id },
      include: {
        timeEntries: true,
        user: {
          include: {
            manager: true,
          },
        },
      },
    });

    if (!timesheet) {
      return notFoundResponse('Feuille de temps');
    }

    // Check ownership
    if (timesheet.userId !== session.user.id) {
      return forbiddenResponse();
    }

    // Check status
    if (!['DRAFT', 'REOPENED'].includes(timesheet.status)) {
      return errorResponse(
        'Cette feuille de temps ne peut pas être soumise dans son état actuel',
        400
      );
    }

    // Check for time entries
    if (timesheet.timeEntries.length === 0) {
      return errorResponse(
        'Impossible de soumettre une feuille de temps vide',
        400
      );
    }

    // Create integrity hash
    const integrityHash = createTimesheetHash(
      timesheet.userId,
      timesheet.weekStart,
      Number(timesheet.totalHours),
      timesheet.timeEntries.length
    );

    // Update timesheet status
    const updated = await prisma.timeSheet.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        integrityHash,
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        totalHours: true,
      },
    });

    // Create approval requests for validators
    const projectIds = [...new Set(timesheet.timeEntries.map((e) => e.projectId))];
    const validators = await prisma.projectValidator.findMany({
      where: { projectId: { in: projectIds } },
      select: { userId: true },
    });

    const uniqueValidatorIds = [...new Set(validators.map((v) => v.userId))];

    // Create pending approvals
    for (const validatorId of uniqueValidatorIds) {
      await prisma.approval.create({
        data: {
          timesheetId: id,
          validatorId,
          status: 'PENDING',
        },
      });

      // Create notification for validator
      await prisma.notification.create({
        data: {
          userId: validatorId,
          type: 'TIMESHEET_SUBMITTED',
          title: 'Nouvelle feuille de temps à valider',
          message: `${timesheet.user.name} a soumis sa feuille de temps pour la semaine du ${timesheet.weekStart.toLocaleDateString('fr-FR')}`,
          data: {
            timesheetId: id,
            userId: timesheet.userId,
            userName: timesheet.user.name,
          },
        },
      });
    }

    await logWorkflowAction('SUBMIT', id, {
      totalHours: timesheet.totalHours,
      entryCount: timesheet.timeEntries.length,
      validators: uniqueValidatorIds,
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
