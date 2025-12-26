import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  serverErrorResponse,
  requireAdmin,
  validateRequest,
  notFoundResponse,
} from '@/lib/api-utils';
import { z } from 'zod';
import { logCrudOperation } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Get a single group
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const group = await prisma.userGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!group) {
      return notFoundResponse('Groupe');
    }

    return successResponse(group);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
  memberIds: z.array(z.string()).optional(),
});

// Update a group
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const { data, error: validationError } = await validateRequest(request, updateGroupSchema);
    if (validationError) return validationError;

    const existingGroup = await prisma.userGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      return notFoundResponse('Groupe');
    }

    // Handle member updates
    if (data.memberIds !== undefined) {
      // Remove all existing members
      await prisma.userGroupMember.deleteMany({
        where: { groupId: id },
      });

      // Add new members
      if (data.memberIds.length > 0) {
        await prisma.userGroupMember.createMany({
          data: data.memberIds.map((userId) => ({
            groupId: id,
            userId,
          })),
        });
      }
    }

    // Update group details
    const { memberIds, ...updateData } = data;
    const group = await prisma.userGroup.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    await logCrudOperation('UPDATE', 'UserGroup', id, {
      details: { ...updateData, memberCount: memberIds?.length, performedBy: session.user.id },
    });

    return successResponse(group);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

// Delete a group
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const existingGroup = await prisma.userGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      return notFoundResponse('Groupe');
    }

    await prisma.userGroup.delete({
      where: { id },
    });

    await logCrudOperation('DELETE', 'UserGroup', id, {
      details: { name: existingGroup.name, performedBy: session.user.id },
    });

    return successResponse({ message: 'Groupe supprimé' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
