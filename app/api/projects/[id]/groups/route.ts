import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAdmin,
  errorResponse,
} from '@/lib/api-utils';
import { logCrudOperation } from '@/lib/audit';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const projectGroupsSchema = z.object({
  groupIds: z.array(z.string()),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
            group: {
              include: {
                members: {
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
              },
            },
          },
        },
      },
    });

    if (!project) {
      return notFoundResponse('Projet');
    }

    return successResponse(project.groups.map((pg) => pg.group));
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        groups: true,
      },
    });

    if (!project) {
      return notFoundResponse('Projet');
    }

    const body = await request.json();
    const result = projectGroupsSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('Données invalides', 400);
    }

    const { groupIds } = result.data;

    // Verify all groups exist
    const existingGroups = await prisma.userGroup.findMany({
      where: { id: { in: groupIds } },
      select: { id: true },
    });

    if (existingGroups.length !== groupIds.length) {
      return errorResponse('Un ou plusieurs groupes sont invalides', 400);
    }

    // Delete existing assignments and create new ones
    await prisma.$transaction([
      prisma.projectGroup.deleteMany({
        where: { projectId: id },
      }),
      prisma.projectGroup.createMany({
        data: groupIds.map((groupId) => ({
          projectId: id,
          groupId,
        })),
      }),
    ]);

    await logCrudOperation('UPDATE', 'Project', id, {
      details: {
        action: 'updateGroups',
        oldGroupIds: project.groups.map((g) => g.groupId),
        newGroupIds: groupIds,
      },
    });

    // Return updated groups
    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
            group: {
              include: {
                members: {
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
              },
            },
          },
        },
      },
    });

    return successResponse(updatedProject?.groups.map((pg) => pg.group) || []);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
