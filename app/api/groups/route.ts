import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  serverErrorResponse,
  requireAdmin,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';
import { logCrudOperation } from '@/lib/audit';

// Get all groups
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');

    const where: { isActive?: boolean } = {};
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const groups = await prisma.userGroup.findMany({
      where,
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
      orderBy: { name: 'asc' },
    });

    return successResponse(groups);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

const createGroupSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  memberIds: z.array(z.string()).optional(),
});

// Create a new group
export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, createGroupSchema);
    if (validationError) return validationError;

    const group = await prisma.userGroup.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        members: data.memberIds
          ? {
              create: data.memberIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
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
        _count: {
          select: { members: true },
        },
      },
    });

    await logCrudOperation('CREATE', 'UserGroup', group.id, {
      details: {
        name: data.name,
        memberCount: data.memberIds?.length || 0,
        performedBy: session.user.id,
      },
    });

    return successResponse(group);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
