import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface AuditLogInput {
  action: AuditAction;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId?: string;
}

/**
 * Create an audit log entry with integrity hash
 */
export async function createAuditLog(input: AuditLogInput) {
  const headersList = await headers();
  const session = await getServerSession(authOptions);

  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const userAgent = headersList.get('user-agent') || 'unknown';
  const userId = input.userId || session?.user?.id;

  // Create signature for integrity verification
  const signatureData = JSON.stringify({
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    userId,
    timestamp: new Date().toISOString(),
    details: input.details,
  });

  const signature = crypto.createHash('sha256').update(signatureData).digest('hex');

  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        details: input.details || {},
        oldValues: input.oldValues,
        newValues: input.newValues,
        userId,
        ip: ip.split(',')[0]?.trim() || 'unknown',
        userAgent: userAgent.substring(0, 500),
        signature,
      },
    });

    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Verify the integrity of an audit log entry
 */
export function verifyAuditLogIntegrity(
  auditLog: {
    action: AuditAction;
    resource: string;
    resourceId: string;
    userId: string | null;
    createdAt: Date;
    details: unknown;
    signature: string | null;
  }
): boolean {
  if (!auditLog.signature) return false;

  const signatureData = JSON.stringify({
    action: auditLog.action,
    resource: auditLog.resource,
    resourceId: auditLog.resourceId,
    userId: auditLog.userId,
    timestamp: auditLog.createdAt.toISOString(),
    details: auditLog.details,
  });

  const expectedSignature = crypto.createHash('sha256').update(signatureData).digest('hex');

  return auditLog.signature === expectedSignature;
}

/**
 * Create a hash for timesheet validation
 */
export function createTimesheetHash(
  userId: string,
  weekStart: Date,
  totalHours: number,
  entryCount: number
): string {
  const data = JSON.stringify({
    userId,
    weekStart: weekStart.toISOString(),
    totalHours,
    entryCount,
    timestamp: new Date().toISOString(),
  });

  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Log a CRUD operation
 */
export async function logCrudOperation(
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  resource: string,
  resourceId: string,
  options?: {
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    details?: Record<string, unknown>;
  }
) {
  return createAuditLog({
    action,
    resource,
    resourceId,
    oldValues: options?.oldValues,
    newValues: options?.newValues,
    details: options?.details,
  });
}

/**
 * Log a workflow action (submit, approve, reject, reopen)
 */
export async function logWorkflowAction(
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REOPEN',
  resourceId: string,
  details?: Record<string, unknown>
) {
  return createAuditLog({
    action,
    resource: 'TimeSheet',
    resourceId,
    details,
  });
}

/**
 * Log an export action
 */
export async function logExportAction(
  format: string,
  details: Record<string, unknown>
) {
  return createAuditLog({
    action: 'EXPORT',
    resource: 'Report',
    resourceId: 'export',
    details: {
      format,
      ...details,
    },
  });
}
