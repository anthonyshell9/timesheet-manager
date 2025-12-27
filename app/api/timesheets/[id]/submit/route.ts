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
      return errorResponse('Impossible de soumettre une feuille de temps vide', 400);
    }

    // Create integrity hash
    const integrityHash = createTimesheetHash(
      timesheet.userId,
      timesheet.id,
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

    // Collect all validator IDs: project validators + user's manager
    const validatorIds = new Set(validators.map((v) => v.userId));

    // Add the user's manager as a validator if they have one
    if (timesheet.user.managerId) {
      validatorIds.add(timesheet.user.managerId);
    }

    // If no validators found, get all users with VALIDATOR or ADMIN role
    if (validatorIds.size === 0) {
      const adminValidators = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'VALIDATOR'] },
          isActive: true,
          id: { not: session.user.id }, // Exclude self
        },
        select: { id: true },
      });
      adminValidators.forEach((v) => validatorIds.add(v.id));
    }

    const uniqueValidatorIds = [...validatorIds];

    // Create pending approvals
    for (const validatorId of uniqueValidatorIds) {
      // Check if approval already exists
      const existingApproval = await prisma.approval.findFirst({
        where: {
          timesheetId: id,
          validatorId,
        },
      });

      if (existingApproval) {
        // Reset existing approval to PENDING (for reopened timesheets)
        await prisma.approval.update({
          where: { id: existingApproval.id },
          data: {
            status: 'PENDING',
            validatedAt: null,
            comment: null,
          },
        });
      } else {
        await prisma.approval.create({
          data: {
            timesheetId: id,
            validatorId,
            status: 'PENDING',
          },
        });
      }

      // Create notification for validator
      await prisma.notification.create({
        data: {
          userId: validatorId,
          type: 'TIMESHEET_SUBMITTED',
          title: 'Nouvelle feuille de temps à valider',
          message: `${timesheet.user.name} a soumis sa feuille de temps (${Number(timesheet.totalHours).toFixed(1)}h)`,
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
