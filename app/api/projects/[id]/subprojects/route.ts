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
import { subProjectCreateSchema } from '@/lib/validations';
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
      select: { id: true },
    });

    if (!project) {
      return notFoundResponse('Projet');
    }

    const subProjects = await prisma.subProject.findMany({
      where: { projectId: id },
      include: {
        _count: {
          select: { timeEntries: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate hours for each sub-project
    const subProjectsWithStats = await Promise.all(
      subProjects.map(async (sp) => {
        const totalMinutes = await prisma.timeEntry.aggregate({
          where: { subProjectId: sp.id },
          _sum: { duration: true },
        });
        return {
          ...sp,
          spentHours: (totalMinutes._sum.duration || 0) / 60,
        };
      })
    );

    return successResponse(subProjectsWithStats);
  } catch (error) {
    return serverErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, code: true },
    });

    if (!project) {
      return notFoundResponse('Projet');
    }

    const { data, error: validationError } = await validateRequest(
      request,
      subProjectCreateSchema.omit({ projectId: true })
    );
    if (validationError) return validationError;

    const subProject = await prisma.subProject.create({
      data: {
        ...data,
        projectId: id,
      },
    });

    await logCrudOperation('CREATE', 'SubProject', subProject.id, {
      details: {
        projectId: id,
        projectCode: project.code,
        subProjectName: data.name,
      },
    });

    return successResponse(subProject);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
