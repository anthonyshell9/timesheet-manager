import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, successResponse, errorResponse, serverErrorResponse, validateRequest } from '@/lib/api-utils';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { z } from 'zod';
import { logCrudOperation } from '@/lib/audit';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
});

export async function POST(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, changePasswordSchema);
    if (validationError) return validationError;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return errorResponse('Utilisateur non trouvé', 404);
    }

    if (!user.password) {
      return errorResponse('Ce compte n\'utilise pas de mot de passe local', 400);
    }

    // Verify current password
    const isValid = await verifyPassword(data.currentPassword, user.password);
    if (!isValid) {
      return errorResponse('Mot de passe actuel incorrect', 400);
    }

    // Hash new password
    const hashedPassword = await hashPassword(data.newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await logCrudOperation('UPDATE', 'User', user.id, {
      details: { action: 'PASSWORD_CHANGED' },
    });

    return successResponse({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
