import { PrismaClient, Role, TimesheetStatus } from '@prisma/client';
import { addDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@timesheet.local' },
    update: {},
    create: {
      email: 'admin@timesheet.local',
      name: 'Admin User',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const validatorUser = await prisma.user.upsert({
    where: { email: 'validator@timesheet.local' },
    update: {},
    create: {
      email: 'validator@timesheet.local',
      name: 'Marie Dupont',
      role: Role.VALIDATOR,
      isActive: true,
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@timesheet.local' },
    update: {},
    create: {
      email: 'user@timesheet.local',
      name: 'Jean Martin',
      role: Role.USER,
      isActive: true,
      managerId: validatorUser.id,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@timesheet.local' },
    update: {},
    create: {
      email: 'user2@timesheet.local',
      name: 'Sophie Bernard',
      role: Role.USER,
      isActive: true,
      managerId: validatorUser.id,
    },
  });

  console.log('Users created');

  // Create projects
  const projectEDF = await prisma.project.upsert({
    where: { code: 'EDF-2024' },
    update: {},
    create: {
      name: 'EDF Transformation Digitale',
      code: 'EDF-2024',
      description: 'Projet de transformation digitale pour EDF',
      hourlyRate: 150.0,
      budgetHours: 2000.0,
      isBillable: true,
      color: '#3B82F6',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
    },
  });

  const projectBNP = await prisma.project.upsert({
    where: { code: 'BNP-RISK' },
    update: {},
    create: {
      name: 'BNP Paribas - Gestion des Risques',
      code: 'BNP-RISK',
      description: 'Mise en place de la solution de gestion des risques',
      hourlyRate: 175.0,
      budgetHours: 1500.0,
      isBillable: true,
      color: '#10B981',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-09-30'),
    },
  });

  const projectInternal = await prisma.project.upsert({
    where: { code: 'INTERNAL' },
    update: {},
    create: {
      name: 'Projets Internes',
      code: 'INTERNAL',
      description: 'Formation, réunions internes, R&D',
      isBillable: false,
      color: '#6B7280',
    },
  });

  console.log('Projects created');

  // Create sub-projects
  const subProjectsEDF = await Promise.all([
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectEDF.id, name: 'Gouvernance' } },
      update: {},
      create: {
        name: 'Gouvernance',
        code: 'GOV',
        projectId: projectEDF.id,
      },
    }),
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectEDF.id, name: 'Développement' } },
      update: {},
      create: {
        name: 'Développement',
        code: 'DEV',
        projectId: projectEDF.id,
      },
    }),
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectEDF.id, name: 'Tests' } },
      update: {},
      create: {
        name: 'Tests',
        code: 'TEST',
        projectId: projectEDF.id,
      },
    }),
  ]);

  const subProjectsBNP = await Promise.all([
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectBNP.id, name: 'Analyse' } },
      update: {},
      create: {
        name: 'Analyse',
        code: 'ANA',
        projectId: projectBNP.id,
      },
    }),
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectBNP.id, name: 'Implémentation' } },
      update: {},
      create: {
        name: 'Implémentation',
        code: 'IMP',
        projectId: projectBNP.id,
      },
    }),
  ]);

  const subProjectsInternal = await Promise.all([
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectInternal.id, name: 'Formation' } },
      update: {},
      create: {
        name: 'Formation',
        code: 'FORM',
        projectId: projectInternal.id,
      },
    }),
    prisma.subProject.upsert({
      where: { projectId_name: { projectId: projectInternal.id, name: 'Réunions' } },
      update: {},
      create: {
        name: 'Réunions',
        code: 'MTG',
        projectId: projectInternal.id,
      },
    }),
  ]);

  console.log('Sub-projects created');

  // Assign validators to projects
  await prisma.projectValidator.upsert({
    where: {
      projectId_userId: { projectId: projectEDF.id, userId: validatorUser.id },
    },
    update: {},
    create: {
      projectId: projectEDF.id,
      userId: validatorUser.id,
    },
  });

  await prisma.projectValidator.upsert({
    where: {
      projectId_userId: { projectId: projectBNP.id, userId: validatorUser.id },
    },
    update: {},
    create: {
      projectId: projectBNP.id,
      userId: validatorUser.id,
    },
  });

  console.log('Project validators assigned');

  // Create sample time entries and timesheets
  const today = new Date();

  // Create timesheet for submitted entries
  const timesheetSubmitted = await prisma.timeSheet.create({
    data: {
      userId: regularUser.id,
      name: 'Feuille de temps décembre',
      status: TimesheetStatus.SUBMITTED,
      totalHours: 40.0,
      submittedAt: new Date(),
    },
  });

  // Create time entries for submitted timesheet
  for (let i = 0; i < 5; i++) {
    const entryDate = addDays(today, -10 + i);
    await prisma.timeEntry.create({
      data: {
        userId: regularUser.id,
        projectId: projectEDF.id,
        subProjectId: subProjectsEDF[i % 3]?.id,
        timesheetId: timesheetSubmitted.id,
        date: entryDate,
        startTime: '09:00',
        endTime: '12:30',
        duration: 210, // 3.5 hours
        description: `Travail sur ${subProjectsEDF[i % 3]?.name || 'projet'}`,
        isBillable: true,
      },
    });

    await prisma.timeEntry.create({
      data: {
        userId: regularUser.id,
        projectId: projectEDF.id,
        subProjectId: subProjectsEDF[(i + 1) % 3]?.id,
        timesheetId: timesheetSubmitted.id,
        date: entryDate,
        startTime: '14:00',
        endTime: '18:30',
        duration: 270, // 4.5 hours
        description: `Développement ${subProjectsEDF[(i + 1) % 3]?.name || 'projet'}`,
        isBillable: true,
      },
    });
  }

  // Create draft timesheet for current entries
  const timesheetDraft = await prisma.timeSheet.create({
    data: {
      userId: regularUser.id,
      status: TimesheetStatus.DRAFT,
      totalHours: 16.0,
    },
  });

  // Create some time entries for draft timesheet
  for (let i = 0; i < 2; i++) {
    const entryDate = addDays(today, -i);
    await prisma.timeEntry.create({
      data: {
        userId: regularUser.id,
        projectId: projectBNP.id,
        subProjectId: subProjectsBNP[0]?.id,
        timesheetId: timesheetDraft.id,
        date: entryDate,
        startTime: '09:00',
        endTime: '17:00',
        duration: 480, // 8 hours
        description: 'Analyse des besoins',
        isBillable: true,
      },
    });
  }

  console.log('Time entries and timesheets created');

  // Create approval for submitted timesheet
  await prisma.approval.upsert({
    where: {
      id: 'approval-seed-1',
    },
    update: {},
    create: {
      id: 'approval-seed-1',
      timesheetId: timesheetSubmitted.id,
      validatorId: validatorUser.id,
      status: 'PENDING',
    },
  });

  console.log('Approvals created');

  // Create default settings
  await prisma.setting.upsert({
    where: { key: 'workingHoursPerDay' },
    update: {},
    create: {
      key: 'workingHoursPerDay',
      value: { hours: 8 },
      category: 'time',
    },
  });

  await prisma.setting.upsert({
    where: { key: 'workingDaysPerWeek' },
    update: {},
    create: {
      key: 'workingDaysPerWeek',
      value: { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
      category: 'time',
    },
  });

  await prisma.setting.upsert({
    where: { key: 'defaultCurrency' },
    update: {},
    create: {
      key: 'defaultCurrency',
      value: { currency: 'EUR', symbol: '€' },
      category: 'billing',
    },
  });

  await prisma.setting.upsert({
    where: { key: 'reminderEnabled' },
    update: {},
    create: {
      key: 'reminderEnabled',
      value: { enabled: true, dayOfWeek: 5, time: '16:00' },
      category: 'notifications',
    },
  });

  console.log('Settings created');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
