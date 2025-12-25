import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  createdResponse,
  serverErrorResponse,
  requireAdmin,
  validateRequest,
  getPagination,
  createPaginationMeta,
} from '@/lib/api-utils';
import { userCreateSchema, paginationSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('q') || '';
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(role && { role: role as 'ADMIN' | 'VALIDATOR' | 'USER' }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          password: true, // To check auth method
          totpEnabled: true,
          azureAdId: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              subordinates: true,
              timesheets: true,
            },
          },
        },
        ...getPagination(page, limit),
        orderBy: { name: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Transform users to include auth method info without exposing password
    const transformedUsers = users.map(({ password, ...user }) => ({
      ...user,
      hasLocalAuth: !!password,
      authMethods: [
        ...(password ? ['local'] : []),
        ...(user.azureAdId ? ['azure'] : []),
      ],
    }));

    return successResponse(transformedUsers, createPaginationMeta(page, limit, total));
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, userCreateSchema);
    if (validationError) return validationError;

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (data.password && (data.authMethod === 'local' || data.authMethod === 'both')) {
      hashedPassword = await hashPassword(data.password);
    }

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        role: data.role,
        managerId: data.managerId,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logCrudOperation('CREATE', 'User', user.id, {
      newValues: {
        email: data.email,
        name: data.name,
        role: data.role,
        authMethod: data.authMethod,
      },
    });

    return createdResponse(user);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
