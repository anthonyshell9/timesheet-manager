import { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: Role;
    };
  }

  interface User {
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'azure-ad') {
        try {
          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (existingUser) {
            // Update last login and Azure AD ID
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                lastLoginAt: new Date(),
                azureAdId: account.providerAccountId,
                name: user.name || existingUser.name,
                image: user.image || existingUser.image,
              },
            });

            // Check if user is active
            if (!existingUser.isActive) {
              return '/auth/error?error=AccountDisabled';
            }
          } else {
            // Create new user with default role
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || 'Unknown User',
                image: user.image,
                azureAdId: account.providerAccountId,
                role: Role.USER,
                lastLoginAt: new Date(),
              },
            });
          }

          // Log the login action
          await logAuditAction({
            action: 'LOGIN',
            userId: existingUser?.id,
            resource: 'User',
            resourceId: existingUser?.id || 'new',
            details: {
              provider: 'azure-ad',
              email: user.email,
            },
          });

          return true;
        } catch (error) {
          console.error('Sign in error:', error);
          return '/auth/error?error=SignInError';
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (account && user) {
        // Get user from database
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, role: true },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async signOut({ token }) {
      // Log the logout action
      if (token?.id) {
        await logAuditAction({
          action: 'LOGOUT',
          userId: token.id as string,
          resource: 'User',
          resourceId: token.id as string,
          details: {},
        });
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

// Helper function for audit logging
async function logAuditAction({
  action,
  userId,
  resource,
  resourceId,
  details,
}: {
  action: 'LOGIN' | 'LOGOUT';
  userId?: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        resource,
        resourceId,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
