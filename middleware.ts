import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const isAuthPage = pathname.startsWith('/auth');
    const isTOTPVerifyPage = pathname === '/auth/totp-verify';
    const isTOTPSetupPage = pathname === '/auth/totp-setup';
    const isSignInPage = pathname === '/auth/signin';
    const isApiRoute = pathname.startsWith('/api');
    const isPublicApiRoute =
      pathname === '/api/health' || pathname === '/api/docs';
    const isTOTPApiRoute = pathname.startsWith('/api/auth/totp');

    // Allow public API routes
    if (isPublicApiRoute) {
      return NextResponse.next();
    }

    // If user is authenticated
    if (token) {
      // Check if TOTP verification is required
      const requiresTOTP = token.requiresTOTP;
      const totpVerified = token.totpVerified;
      const needsTOTPVerification = requiresTOTP && !totpVerified;

      // Allow TOTP API routes for users needing verification
      if (isTOTPApiRoute) {
        const response = NextResponse.next();
        addSecurityHeaders(response);
        return response;
      }

      // If user needs TOTP verification
      if (needsTOTPVerification) {
        // Allow access to TOTP verify page
        if (isTOTPVerifyPage) {
          const response = NextResponse.next();
          addSecurityHeaders(response);
          return response;
        }

        // Redirect all other pages to TOTP verification
        if (!isSignInPage) {
          const url = new URL('/auth/totp-verify', req.url);
          url.searchParams.set('callbackUrl', pathname);
          return NextResponse.redirect(url);
        }
      }

      // If user is authenticated and TOTP verified (or not required)
      // Redirect from sign-in page to dashboard
      if (isSignInPage) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      // Allow TOTP setup page
      if (isTOTPSetupPage) {
        const response = NextResponse.next();
        addSecurityHeaders(response);
        return response;
      }

      // If user has verified TOTP, redirect away from TOTP verify page
      if (isTOTPVerifyPage && !needsTOTPVerification) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      // Role-based access control
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
    addSecurityHeaders(response);
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const isAuthPage = pathname.startsWith('/auth');
        const isPublicPage = pathname === '/';
        const isPublicApiRoute =
          pathname === '/api/health' || pathname === '/api/docs';

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

function addSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

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
