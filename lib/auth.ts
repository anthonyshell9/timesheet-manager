import { NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: Role;
      isLocalAccount?: boolean;
      totpEnabled?: boolean;
      totpVerified?: boolean;
    };
  }

  interface User {
    role: Role;
    isLocalAccount?: boolean;
    totpEnabled?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    isLocalAccount?: boolean;
    totpEnabled?: boolean;
    totpVerified?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Azure AD Provider - Only for existing users
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

    // Credentials Provider for local login
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Mot de passe',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            password: true,
            isActive: true,
            totpEnabled: true,
          },
        });

        if (!user) {
          throw new Error('Identifiants invalides');
        }

        if (!user.isActive) {
          throw new Error('Compte désactivé');
        }

        if (!user.password) {
          throw new Error('Ce compte utilise uniquement Azure AD');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Identifiants invalides');
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          requiresTOTP: user.totpEnabled,
        };
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
    async signIn({ user, account, credentials }) {
      if (account?.provider === 'azure-ad') {
        try {
          // Check if user exists in database - REQUIRED for Azure AD
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (!existingUser) {
            // Reject login - user must be pre-created in the system
            return '/auth/error?error=AccessDenied';
          }

          if (!existingUser.isActive) {
            return '/auth/error?error=AccountDisabled';
          }

          // Update user info from Azure AD
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              lastLoginAt: new Date(),
              azureAdId: account.providerAccountId,
              name: user.name || existingUser.name,
              image: user.image || existingUser.image,
            },
          });

          // Log the login action
          await logAuditAction({
            action: 'LOGIN',
            userId: existingUser.id,
            resource: 'User',
            resourceId: existingUser.id,
            details: {
              provider: 'azure-ad',
              email: user.email,
            },
          });

          return true;
        } catch (error) {
          console.error('Azure AD sign in error:', error);
          return '/auth/error?error=SignInError';
        }
      }

      // For credentials provider
      if (account?.provider === 'credentials') {
        try {
          await logAuditAction({
            action: 'LOGIN',
            userId: user.id,
            resource: 'User',
            resourceId: user.id,
            details: {
              provider: 'credentials',
              email: user.email,
            },
          });
          return true;
        } catch (error) {
          console.error('Credentials sign in error:', error);
          return '/auth/error?error=SignInError';
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      if (account && user) {
        // Initial sign in
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, role: true, totpEnabled: true, password: true },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.isLocalAccount = !!dbUser.password;
          token.totpEnabled = dbUser.totpEnabled;
          // Azure AD users are always verified, local users need TOTP verification if enabled
          token.totpVerified = account.provider === 'azure-ad' ? true : !dbUser.totpEnabled;
        }
      }

      // Handle session update (e.g., TOTP verification or setup completion)
      if (trigger === 'update' && token) {
        // Check if this is a TOTP verification update
        if (session?.totpVerified === true) {
          token.totpVerified = true;
        }

        // Refresh user data from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, totpEnabled: true, password: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isLocalAccount = !!dbUser.password;
          token.totpEnabled = dbUser.totpEnabled;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isLocalAccount = token.isLocalAccount;
        session.user.totpEnabled = token.totpEnabled;
        session.user.totpVerified = token.totpVerified;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async signOut({ token }) {
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

// Password hashing utility
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Password verification utility
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
