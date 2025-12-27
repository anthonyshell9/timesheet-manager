import { NextRequest } from 'next/server';
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
import { logCrudOperation } from '@/lib/audit';

const enableTOTPSchema = z.object({
  token: z.string().length(6, 'Le code doit contenir 6 chiffres'),
});

// POST - Verify token and enable TOTP
export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, enableTOTPSchema);
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

    if (user.totpEnabled) {
      return errorResponse('TOTP est déjà activé', 400);
    }

    if (!user.totpSecret) {
      return errorResponse("Veuillez d'abord configurer TOTP", 400);
    }

    // Verify the token
    const isValid = verifyTOTP(data.token, user.totpSecret);
    if (!isValid) {
      return errorResponse('Code invalide. Veuillez réessayer.', 400);
    }

    // Enable TOTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpVerifiedAt: new Date(),
      },
    });

    await logCrudOperation('UPDATE', 'User', user.id, {
      newValues: { totpEnabled: true },
      details: { action: 'TOTP_ENABLED' },
    });

    return successResponse({ message: 'MFA activé avec succès' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
