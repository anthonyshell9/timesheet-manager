import { z } from 'zod';

// ==================== User Validations ====================

export const userCreateSchema = z.object({
  email: z.string().email('Email invalide'),
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  role: z.enum(['ADMIN', 'VALIDATOR', 'USER']).default('USER'),
  managerId: z.string().optional().nullable(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'VALIDATOR', 'USER']).optional(),
  managerId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ==================== Project Validations ====================

export const projectCreateSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  code: z
    .string()
    .min(2, 'Le code doit contenir au moins 2 caractères')
    .max(20, 'Le code doit contenir au maximum 20 caractères')
    .regex(/^[A-Z0-9-]+$/, 'Le code ne peut contenir que des lettres majuscules, chiffres et tirets'),
  description: z.string().optional().nullable(),
  hourlyRate: z.number().nonnegative('Le taux horaire doit être positif ou nul').optional().nullable(),
  budgetHours: z.number().nonnegative('Le budget heures doit être positif ou nul').optional().nullable(),
  isBillable: z.boolean().default(true),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide').optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

// ==================== SubProject Validations ====================

export const subProjectCreateSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  code: z.string().optional(),
  description: z.string().optional(),
  projectId: z.string(),
});

export const subProjectUpdateSchema = subProjectCreateSchema.partial().omit({ projectId: true });

// ==================== TimeEntry Validations ====================

export const timeEntryCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  duration: z.number().int().positive('La durée doit être positive'),
  description: z.string().optional(),
  projectId: z.string(),
  subProjectId: z.string().optional(),
  isBillable: z.boolean().default(true),
  isTimerEntry: z.boolean().default(false),
});

export const timeEntryUpdateSchema = timeEntryCreateSchema.partial();

export const timeEntryBulkCreateSchema = z.object({
  entries: z.array(timeEntryCreateSchema),
});

// ==================== TimeSheet Validations ====================

export const timesheetCreateSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide'),
});

export const timesheetSubmitSchema = z.object({
  timesheetId: z.string(),
});

export const timesheetActionSchema = z.object({
  timesheetId: z.string(),
  comment: z.string().optional(),
});

// ==================== Approval Validations ====================

export const approvalCreateSchema = z.object({
  timesheetId: z.string(),
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

// ==================== Report Validations ====================

export const reportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'project', 'user']).optional(),
});

// ==================== Export Validations ====================

export const exportSchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  includeDetails: z.boolean().default(true),
});

// ==================== Settings Validations ====================

export const settingUpdateSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  category: z.string().optional(),
});

// ==================== Pagination Validations ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==================== Search Validations ====================

export const searchSchema = z.object({
  q: z.string().min(1).optional(),
  ...paginationSchema.shape,
});

// Type exports
export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type SubProjectCreate = z.infer<typeof subProjectCreateSchema>;
export type SubProjectUpdate = z.infer<typeof subProjectUpdateSchema>;
export type TimeEntryCreate = z.infer<typeof timeEntryCreateSchema>;
export type TimeEntryUpdate = z.infer<typeof timeEntryUpdateSchema>;
export type TimesheetCreate = z.infer<typeof timesheetCreateSchema>;
export type ApprovalCreate = z.infer<typeof approvalCreateSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ExportParams = z.infer<typeof exportSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
