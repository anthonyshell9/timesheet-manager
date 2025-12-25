import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
    const isApiRoute = req.nextUrl.pathname.startsWith('/api');
    const isPublicApiRoute =
      req.nextUrl.pathname === '/api/health' || req.nextUrl.pathname === '/api/docs';

    // Allow public API routes
    if (isPublicApiRoute) {
      return NextResponse.next();
    }

    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (isAuthPage && token) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Role-based access control
    if (token) {
      const pathname = req.nextUrl.pathname;

      // Admin-only routes
      if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }

      // Validator-only routes (validators and admins can access)
      if (
        pathname.startsWith('/validations') &&
        token.role !== 'VALIDATOR' &&
        token.role !== 'ADMIN'
      ) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    // Add security headers
    const response = NextResponse.next();
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
        const isPublicPage = req.nextUrl.pathname === '/';
        const isPublicApiRoute =
          req.nextUrl.pathname === '/api/health' || req.nextUrl.pathname === '/api/docs';

        // Allow public pages and auth pages without authentication
        if (isAuthPage || isPublicPage || isPublicApiRoute) {
          return true;
        }

        // Require authentication for all other routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
