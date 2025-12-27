import { prisma } from '@/lib/prisma';
import {
  successResponse,
  serverErrorResponse,
  requireValidator,
} from '@/lib/api-utils';
import { startOfWeek, endOfWeek } from 'date-fns';

export async function GET() {
  try {
    const { session, error: authError } = await requireValidator();
    if (authError) return authError;

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    // Get team members based on user role
    let teamMemberIds: string[] = [];

    if (session.user.role === 'ADMIN') {
      // Admin sees all users except themselves
      const allUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: session.user.id },
        },
        select: { id: true },
      });
      teamMemberIds = allUsers.map((u) => u.id);
    } else {
      // Validator sees their subordinates
      const subordinates = await prisma.user.findMany({
        where: {
          managerId: session.user.id,
          isActive: true,
        },
        select: { id: true },
      });
      teamMemberIds = subordinates.map((s) => s.id);

      // Also include users from projects they validate
      const validatingProjects = await prisma.projectValidator.findMany({
        where: { userId: session.user.id },
        select: { projectId: true },
      });
      const projectIds = validatingProjects.map((p) => p.projectId);

      if (projectIds.length > 0) {
        // Get users assigned to these projects
        const projectUsers = await prisma.projectAssignment.findMany({
          where: {
            projectId: { in: projectIds },
            user: { isActive: true, id: { not: session.user.id } },
          },
          select: { userId: true },
        });
        const projectUserIds = projectUsers.map((p) => p.userId);
        teamMemberIds = [...new Set([...teamMemberIds, ...projectUserIds])];
      }
    }

    if (teamMemberIds.length === 0) {
      return successResponse([]);
    }

    // Get all team members with their timesheet status
    const teamMembers = await prisma.user.findMany({
      where: { id: { in: teamMemberIds } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        timesheets: {
          where: {
            OR: [
              // Timesheets submitted this week
              {
                status: { in: ['SUBMITTED', 'APPROVED'] },
                submittedAt: { gte: weekStart, lte: weekEnd },
              },
              // Pending approval timesheets
              {
                status: 'SUBMITTED',
              },
            ],
          },
          select: {
            id: true,
            status: true,
            totalHours: true,
            submittedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        timeEntries: {
          where: {
            date: { gte: weekStart, lte: weekEnd },
          },
          select: { duration: true },
        },
      },
    });

    // Get last submitted timesheet for each user
    const lastTimesheets = await prisma.timeSheet.findMany({
      where: {
        userId: { in: teamMemberIds },
        status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] },
      },
      select: {
        userId: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: 'desc' },
    });

    const lastTimesheetByUser: Record<string, Date | null> = {};
    lastTimesheets.forEach((ts) => {
      if (!lastTimesheetByUser[ts.userId] && ts.submittedAt) {
        lastTimesheetByUser[ts.userId] = ts.submittedAt;
      }
    });

    const result = teamMembers.map((member) => {
      const totalHoursThisWeek = member.timeEntries.reduce((acc, e) => acc + e.duration, 0) / 60;
      const hasSubmittedThisWeek = member.timesheets.some(
        (ts) =>
          ts.submittedAt &&
          new Date(ts.submittedAt) >= weekStart &&
          new Date(ts.submittedAt) <= weekEnd &&
          (ts.status === 'SUBMITTED' || ts.status === 'APPROVED')
      );
      const pendingTimesheet = member.timesheets.find((ts) => ts.status === 'SUBMITTED');

      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        hasSubmittedThisWeek,
        hasSubmittedThisMonth: hasSubmittedThisWeek, // Simplified
        lastTimesheetDate: lastTimesheetByUser[member.id]?.toISOString() || null,
        totalHoursThisWeek,
        pendingTimesheet: pendingTimesheet
          ? { id: pendingTimesheet.id, totalHours: Number(pendingTimesheet.totalHours) }
          : null,
      };
    });

    // Sort: pending first, then by missing submission, then alphabetically
    result.sort((a, b) => {
      if (a.pendingTimesheet && !b.pendingTimesheet) return -1;
      if (!a.pendingTimesheet && b.pendingTimesheet) return 1;
      if (!a.hasSubmittedThisWeek && b.hasSubmittedThisWeek) return -1;
      if (a.hasSubmittedThisWeek && !b.hasSubmittedThisWeek) return 1;
      return a.name.localeCompare(b.name);
    });

    return successResponse(result);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
