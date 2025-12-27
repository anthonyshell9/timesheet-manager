import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireValidator,
  errorResponse,
} from '@/lib/api-utils';
import { logWorkflowAction } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireValidator();
    if (authError) return authError;

    const { id } = await params;

    const timesheet = await prisma.timeSheet.findUnique({
      where: { id },
      include: {
        timeEntries: {
          select: { projectId: true },
        },
        user: true,
      },
    });

    if (!timesheet) {
      return notFoundResponse('Feuille de temps');
    }

    // Check if user can reopen this timesheet
    if (session.user.role !== 'ADMIN') {
      const projectIds = [...new Set(timesheet.timeEntries.map((e) => e.projectId))];
      const validatorCheck = await prisma.projectValidator.findFirst({
        where: {
          userId: session.user.id,
          projectId: { in: projectIds },
        },
      });

      if (!validatorCheck) {
        return errorResponse("Vous n'êtes pas autorisé à rouvrir cette feuille de temps", 403);
      }
    }

    // Check status
    if (!['APPROVED', 'REJECTED'].includes(timesheet.status)) {
      return errorResponse(
        'Seules les feuilles de temps validées ou refusées peuvent être rouvertes',
        400
      );
    }

    // Get comment from request body if provided
    let comment = '';
    try {
      const body = await request.json();
      comment = body.comment || '';
    } catch {
      // No body provided
    }

    // Update timesheet status
    const updated = await prisma.timeSheet.update({
      where: { id },
      data: {
        status: 'REOPENED',
        lockedAt: null,
        lockedById: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    // Clear pending approvals
    await prisma.approval.updateMany({
      where: {
        timesheetId: id,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        comment: 'Feuille de temps rouverte',
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: timesheet.userId,
        type: 'TIMESHEET_REOPENED',
        title: 'Feuille de temps rouverte',
        message: `Votre feuille de temps a été rouverte par ${session.user.name}${comment ? `: ${comment}` : ''}`,
        data: {
          timesheetId: id,
          validatorId: session.user.id,
          validatorName: session.user.name,
          comment,
        },
      },
    });

    await logWorkflowAction('REOPEN', id, {
      validatorId: session.user.id,
      comment,
      previousStatus: timesheet.status,
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
