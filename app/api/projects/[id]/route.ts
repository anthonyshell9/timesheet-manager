import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAuth,
  requireAdmin,
  validateRequest,
} from '@/lib/api-utils';
import { projectUpdateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        subProjects: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        validators: {
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
        groups: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                color: true,
                members: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            timeEntries: true,
          },
        },
      },
    });

    if (!project) {
      return notFoundResponse('Projet');
    }

    // Calculate statistics
    const [totalMinutes, entryStats] = await Promise.all([
      prisma.timeEntry.aggregate({
        where: { projectId: id },
        _sum: { duration: true },
      }),
      prisma.timeEntry.groupBy({
        by: ['subProjectId'],
        where: { projectId: id },
        _sum: { duration: true },
      }),
    ]);

    const projectWithStats = {
      ...project,
      spentHours: (totalMinutes._sum.duration || 0) / 60,
      subProjectStats: entryStats,
    };

    return successResponse(projectWithStats);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return notFoundResponse('Projet');
    }

    const { data, error: validationError } = await validateRequest(request, projectUpdateSchema);
    if (validationError) return validationError;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    await logCrudOperation('UPDATE', 'Project', project.id, {
      oldValues: existingProject,
      newValues: data,
    });

    return successResponse(project);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, code: true, _count: { select: { timeEntries: true } } },
    });

    if (!project) {
      return notFoundResponse('Projet');
    }

    // Soft delete - deactivate instead of deleting if has time entries
    if (project._count.timeEntries > 0) {
      await prisma.project.update({
        where: { id },
        data: { isActive: false },
      });

      await logCrudOperation('DELETE', 'Project', id, {
        details: { softDelete: true, code: project.code },
      });

      return successResponse({ message: 'Projet désactivé' });
    }

    // Hard delete if no time entries
    await prisma.project.delete({
      where: { id },
    });

    await logCrudOperation('DELETE', 'Project', id, {
      details: { hardDelete: true, code: project.code },
    });

    return successResponse({ message: 'Projet supprimé' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
