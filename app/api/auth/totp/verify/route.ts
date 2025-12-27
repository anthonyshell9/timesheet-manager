import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  successResponse,
  errorResponse,
  serverErrorResponse,
  validateRequest,
} from '@/lib/api-utils';
import { verifyTOTP } from '@/lib/totp';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { encode } from 'next-auth/jwt';
import { logCrudOperation } from '@/lib/audit';

const verifyTOTPSchema = z.object({
  token: z.string().length(6, 'Le code doit contenir 6 chiffres'),
});

// POST - Verify TOTP token during login
export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, verifyTOTPSchema);
    if (validationError) return validationError;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        totpSecret: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      return errorResponse('Utilisateur non trouvé', 404);
    }

    if (!user.totpEnabled || !user.totpSecret) {
      return errorResponse("TOTP n'est pas activé pour ce compte", 400);
    }

    // Verify the token
    const isValid = verifyTOTP(data.token, user.totpSecret);
    if (!isValid) {
      return errorResponse('Code invalide. Veuillez réessayer.', 400);
    }

    // Log TOTP verification
    await logCrudOperation('UPDATE', 'User', user.id, {
      details: { action: 'TOTP_VERIFIED' },
    });

    // Return success - the client will trigger a session update
    return successResponse({
      verified: true,
      message: 'Authentification réussie',
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
