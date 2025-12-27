import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { generateTOTPSecret, generateTOTPUri, generateQRCodeDataURL } from '@/lib/totp';

// GET - Generate new TOTP secret and QR code for setup
export async function GET(request: NextRequest) {
  try {
    const { session, error: authError } = await requireAuth();
    if (authError) return authError;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        totpEnabled: true,
        password: true,
      },
    });

    if (!user) {
      return errorResponse('Utilisateur non trouvé', 404);
    }

    // TOTP is only for local accounts (those with passwords)
    if (!user.password) {
      return errorResponse("MFA n'est disponible que pour les comptes locaux", 400);
    }

    if (user.totpEnabled) {
      return errorResponse('TOTP est déjà activé pour ce compte', 400);
    }

    // Generate new secret
    const secret = generateTOTPSecret();
    const otpauthUrl = generateTOTPUri(user.email, secret);
    const qrCodeDataUrl = await generateQRCodeDataURL(otpauthUrl);

    // Store the secret temporarily (not enabled yet)
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: secret },
    });

    return successResponse({
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
    });
  } catch (error) {
    return serverErrorResponse(error);
  }
}
