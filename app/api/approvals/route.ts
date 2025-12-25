import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  serverErrorResponse,
  requireValidator,
  validateRequest,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-utils';
import { approvalCreateSchema } from '@/lib/validations';
import { logWorkflowAction } from '@/lib/audit';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const { session, error: authError } = await requireValidator();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const where =
      session.user.role === 'ADMIN'
        ? { ...(status && { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }) }
        : {
            validatorId: session.user.id,
            ...(status && { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }),
          };

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        timesheet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        validator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(approvals);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireValidator();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(
      request,
      approvalCreateSchema
    );
    if (validationError) return validationError;

    // Find the approval record
    const approval = await prisma.approval.findFirst({
      where: {
        timesheetId: data.timesheetId,
        validatorId: session.user.id,
        status: 'PENDING',
      },
      include: {
        timesheet: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!approval) {
      return notFoundResponse('Demande de validation');
    }

    // Create signature for this action
    const signatureData = JSON.stringify({
      timesheetId: data.timesheetId,
      validatorId: session.user.id,
      status: data.status,
      timestamp: new Date().toISOString(),
    });
    const signature = crypto.createHash('sha256').update(signatureData).digest('hex');

    // Update approval
    const updated = await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: data.status,
        comment: data.comment,
        signature,
      },
    });

    // Update timesheet status
    const timesheetStatus = data.status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await prisma.timeSheet.update({
      where: { id: data.timesheetId },
      data: {
        status: timesheetStatus,
        lockedAt: new Date(),
        lockedById: session.user.id,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: approval.timesheet.userId,
        type: data.status === 'APPROVED' ? 'TIMESHEET_APPROVED' : 'TIMESHEET_REJECTED',
        title:
          data.status === 'APPROVED'
            ? 'Feuille de temps approuvée'
            : 'Feuille de temps refusée',
        message:
          data.status === 'APPROVED'
            ? `Votre feuille de temps a été approuvée par ${session.user.name}`
            : `Votre feuille de temps a été refusée par ${session.user.name}${data.comment ? `: ${data.comment}` : ''}`,
        data: {
          timesheetId: data.timesheetId,
          validatorId: session.user.id,
          validatorName: session.user.name,
          comment: data.comment,
        },
      },
    });

    await logWorkflowAction(data.status, data.timesheetId, {
      validatorId: session.user.id,
      comment: data.comment,
    });

    return successResponse(updated);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
