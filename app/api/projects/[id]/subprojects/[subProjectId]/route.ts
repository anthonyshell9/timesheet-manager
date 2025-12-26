import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAdmin,
  validateRequest,
} from '@/lib/api-utils';
import { subProjectUpdateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string; subProjectId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id, subProjectId } = await params;

    const existingSubProject = await prisma.subProject.findFirst({
      where: { id: subProjectId, projectId: id },
    });

    if (!existingSubProject) {
      return notFoundResponse('Sous-projet');
    }

    const { data, error: validationError } = await validateRequest(
      request,
      subProjectUpdateSchema
    );
    if (validationError) return validationError;

    const subProject = await prisma.subProject.update({
      where: { id: subProjectId },
      data,
    });

    await logCrudOperation('UPDATE', 'SubProject', subProject.id, {
      oldValues: existingSubProject,
      newValues: data,
    });

    return successResponse(subProject);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id, subProjectId } = await params;

    const subProject = await prisma.subProject.findFirst({
      where: { id: subProjectId, projectId: id },
      include: {
        _count: { select: { timeEntries: true } },
      },
    });

    if (!subProject) {
      return notFoundResponse('Sous-projet');
    }

    // Soft delete if has time entries
    if (subProject._count.timeEntries > 0) {
      await prisma.subProject.update({
        where: { id: subProjectId },
        data: { isActive: false },
      });

      await logCrudOperation('DELETE', 'SubProject', subProjectId, {
        details: { softDelete: true, name: subProject.name },
      });

      return successResponse({ message: 'Sous-projet désactivé' });
    }

    // Hard delete if no time entries
    await prisma.subProject.delete({
      where: { id: subProjectId },
    });

    await logCrudOperation('DELETE', 'SubProject', subProjectId, {
      details: { hardDelete: true, name: subProject.name },
    });

    return successResponse({ message: 'Sous-projet supprimé' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
