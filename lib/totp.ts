import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Configure authenticator
authenticator.options = {
  window: 1, // Allow 1 step before/after for time drift
};

const APP_NAME = 'TimeSheet Manager';

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate TOTP URI for authenticator apps
 */
export function generateTOTPUri(email: string, secret: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/**
 * Generate QR code as data URL
 */
export async function generateQRCodeDataURL(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Generate current TOTP token (for testing)
 */
export function generateTOTP(secret: string): string {
  return authenticator.generate(secret);
}
