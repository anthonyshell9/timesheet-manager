import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  createdResponse,
  serverErrorResponse,
  requireAuth,
  requireAdmin,
  validateRequest,
  getPagination,
  createPaginationMeta,
} from '@/lib/api-utils';
import { projectCreateSchema } from '@/lib/validations';
import { logCrudOperation } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('q') || '';
    const isActive = searchParams.get('isActive');
    const isBillable = searchParams.get('isBillable');

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
      ...(isBillable !== null && { isBillable: isBillable === 'true' }),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          hourlyRate: true,
          budgetHours: true,
          isActive: true,
          isBillable: true,
          color: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          subProjects: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              code: true,
            },
            orderBy: { name: 'asc' },
          },
          validators: {
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
          _count: {
            select: {
              timeEntries: true,
            },
          },
        },
        ...getPagination(page, limit),
        orderBy: { name: 'asc' },
      }),
      prisma.project.count({ where }),
    ]);

    // Calculate spent hours for each project
    const projectsWithSpent = await Promise.all(
      projects.map(async (project) => {
        const totalMinutes = await prisma.timeEntry.aggregate({
          where: { projectId: project.id },
          _sum: { duration: true },
        });

        return {
          ...project,
          spentHours: (totalMinutes._sum.duration || 0) / 60,
        };
      })
    );

    return successResponse(projectsWithSpent, createPaginationMeta(page, limit, total));
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, projectCreateSchema);
    if (validationError) return validationError;

    const project = await prisma.project.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        hourlyRate: data.hourlyRate,
        budgetHours: data.budgetHours,
        isBillable: data.isBillable,
        color: data.color,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        hourlyRate: true,
        budgetHours: true,
        isActive: true,
        isBillable: true,
        color: true,
        createdAt: true,
      },
    });

    await logCrudOperation('CREATE', 'Project', project.id, {
      newValues: data,
    });

    return createdResponse(project);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
