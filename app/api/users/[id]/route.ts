import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  requireAuth,
  requireAdmin,
  validateRequest,
  forbiddenResponse,
} from '@/lib/api-utils';
import { userUpdateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;

    // Users can view their own profile, admins can view any
    if (session.user.id !== id && session.user.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        password: true,
        totpEnabled: true,
        azureAdId: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        validatingProjects: {
          select: {
            project: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        _count: {
          select: {
            timesheets: true,
            timeEntries: true,
            approvals: true,
          },
        },
      },
    });

    if (!user) {
      return notFoundResponse('Utilisateur');
    }

    // Transform to include auth info without exposing password
    const { password, ...userWithoutPassword } = user;
    const transformedUser = {
      ...userWithoutPassword,
      hasLocalAuth: !!password,
      authMethods: [
        ...(password ? ['local'] : []),
        ...(user.azureAdId ? ['azure'] : []),
      ],
    };

    return successResponse(transformedUser);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, managerId: true, isActive: true, totpEnabled: true },
    });

    if (!existingUser) {
      return notFoundResponse('Utilisateur');
    }

    const { data, error: validationError } = await validateRequest(request, userUpdateSchema);
    if (validationError) return validationError;

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    // Handle standard fields
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.managerId !== undefined) updateData.managerId = data.managerId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Handle password update
    if (data.password) {
      updateData.password = await hashPassword(data.password);
    }

    // Handle TOTP reset
    if (data.resetTOTP === true) {
      updateData.totpEnabled = false;
      updateData.totpSecret = null;
      updateData.totpVerifiedAt = null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
        totpEnabled: true,
      },
    });

    await logCrudOperation('UPDATE', 'User', user.id, {
      oldValues: existingUser,
      newValues: {
        ...data,
        password: data.password ? '[REDACTED]' : undefined,
      },
    });

    return successResponse(user);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!user) {
      return notFoundResponse('Utilisateur');
    }

    // Soft delete - just deactivate the user
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await logCrudOperation('DELETE', 'User', id, {
      details: { softDelete: true, email: user.email },
    });

    return successResponse({ message: 'Utilisateur désactivé' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
