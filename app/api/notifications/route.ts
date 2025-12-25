import { NextRequest } from 'next/server';
import { successResponse, serverErrorResponse, requireAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    // Return empty notifications for now
    // TODO: Implement real notifications
    return successResponse([]);
  } catch (error) {
    return serverErrorResponse(error);
  }
}
