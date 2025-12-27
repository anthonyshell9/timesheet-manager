import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role } from '@prisma/client';

// Extended session type with our custom user properties
export interface ExtendedSession extends Session {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
    role: Role;
    isLocalAccount?: boolean;
    totpEnabled?: boolean;
    totpVerified?: boolean;
    requiresTOTP?: boolean;
  };
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// Success response helper
export function successResponse<T>(data: T, meta?: ApiResponse['meta']): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta && { meta }),
    } satisfies ApiResponse<T>,
    { status: 200 }
  );
}

// Created response helper
export function createdResponse<T>(data: T): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    } satisfies ApiResponse<T>,
    { status: 201 }
  );
}

// Error response helpers
export function errorResponse(
  message: string,
  status: number = 400,
  errors?: Record<string, string[]>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(errors && { errors }),
    } satisfies ApiResponse,
    { status }
  );
}

export function notFoundResponse(resource: string = 'Resource'): NextResponse {
  return errorResponse(`${resource} non trouvé`, 404);
}

export function unauthorizedResponse(message: string = 'Non autorisé'): NextResponse {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message: string = 'Accès interdit'): NextResponse {
  return errorResponse(message, 403);
}

export function validationErrorResponse(error: ZodError): NextResponse {
  const errors: Record<string, string[]> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return NextResponse.json(
    {
      success: false,
      error: 'Erreur de validation',
      errors,
    } satisfies ApiResponse,
    { status: 400 }
  );
}

export function serverErrorResponse(error: unknown): NextResponse {
  console.error('Server error:', error);
  return errorResponse('Erreur interne du serveur', 500);
}

// Request validation helper
export async function validateRequest<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ZodError) {
      return { data: null, error: validationErrorResponse(error) };
    }
    return { data: null, error: errorResponse('Corps de requête invalide') };
  }
}

// Query params validation helper
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T; error: null } | { data: null; error: NextResponse } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const data = schema.parse(params);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ZodError) {
      return { data: null, error: validationErrorResponse(error) };
    }
    return { data: null, error: errorResponse('Paramètres de requête invalides') };
  }
}

// Auth helpers
export async function requireAuth(): Promise<
  { session: ExtendedSession; error: null } | { session: null; error: NextResponse }
> {
  const session = (await getServerSession(authOptions)) as ExtendedSession | null;

  if (!session?.user) {
    return { session: null, error: unauthorizedResponse('Session non valide') };
  }

  return { session, error: null };
}

export async function requireRole(
  allowedRoles: Role[]
): Promise<{ session: ExtendedSession; error: null } | { session: null; error: NextResponse }> {
  const { session, error } = await requireAuth();

  if (error) return { session: null, error };

  if (!allowedRoles.includes(session.user.role)) {
    return {
      session: null,
      error: forbiddenResponse("Vous n'avez pas les permissions nécessaires"),
    };
  }

  return { session, error: null };
}

export async function requireAdmin() {
  return requireRole(['ADMIN']);
}

export async function requireValidator() {
  return requireRole(['ADMIN', 'VALIDATOR']);
}

// Pagination helper
export function getPagination(page: number, limit: number) {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
}

export function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
