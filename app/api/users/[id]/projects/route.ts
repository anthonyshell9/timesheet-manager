import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  serverErrorResponse,
  requireAdmin,
  notFoundResponse,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';
import { logCrudOperation } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get user's project assignments
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                isActive: true,
              },
            },
          },
        },
        validatingProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return notFoundResponse('Utilisateur');
    }

    return successResponse({
      assignedProjects: user.assignedProjects.map((p) => p.project),
      validatingProjects: user.validatingProjects.map((p) => p.project),
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}

const updateProjectsSchema = z.object({
  assignedProjectIds: z.array(z.string()).optional(),
  validatingProjectIds: z.array(z.string()).optional(),
});

// Update user's project assignments
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const { data, error: validationError } = await validateRequest(request, updateProjectsSchema);
    if (validationError) return validationError;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return notFoundResponse('Utilisateur');
    }

    // Update assigned projects
    if (data.assignedProjectIds !== undefined) {
      // Remove all existing assignments
      await prisma.projectMember.deleteMany({
        where: { userId: id },
      });

      // Add new assignments
      if (data.assignedProjectIds.length > 0) {
        await prisma.projectMember.createMany({
          data: data.assignedProjectIds.map((projectId) => ({
            userId: id,
            projectId,
          })),
        });
      }

      await logCrudOperation('UPDATE', 'ProjectMember', id, {
        details: { action: 'ASSIGN_PROJECTS', projectIds: data.assignedProjectIds, performedBy: session.user.id },
      });
    }

    // Update validating projects
    if (data.validatingProjectIds !== undefined) {
      // Remove all existing validator assignments
      await prisma.projectValidator.deleteMany({
        where: { userId: id },
      });

      // Add new validator assignments
      if (data.validatingProjectIds.length > 0) {
        await prisma.projectValidator.createMany({
          data: data.validatingProjectIds.map((projectId) => ({
            userId: id,
            projectId,
          })),
        });
      }

      await logCrudOperation('UPDATE', 'ProjectValidator', id, {
        details: { action: 'ASSIGN_VALIDATOR', projectIds: data.validatingProjectIds, performedBy: session.user.id },
      });
    }

    // Fetch updated data
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                isActive: true,
              },
            },
          },
        },
        validatingProjects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return successResponse({
      assignedProjects: updatedUser?.assignedProjects.map((p) => p.project) || [],
      validatingProjects: updatedUser?.validatingProjects.map((p) => p.project) || [],
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
