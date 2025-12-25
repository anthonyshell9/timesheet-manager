'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { Suspense } from 'react';

function TOTPVerifyContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    // If user doesn't require TOTP or already verified, redirect
    if (status === 'authenticated' && session?.user) {
      if (!session.user.requiresTOTP || session.user.totpVerified) {
        router.push(callbackUrl);
      }
    }
  }, [status, session, router, callbackUrl]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Code invalide');
      }

      // Update session to mark TOTP as verified
      await update({ totpVerified: true });

      // Redirect to callback URL
      router.push(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de vérification');
      setVerificationCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Vérification MFA
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entrez le code de votre application d'authentification
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Verification Card */}
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Code de vérification</CardTitle>
            <CardDescription>
              Ouvrez votre application d'authentification et entrez le code à 6 chiffres
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="sr-only">Code de vérification</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-3xl tracking-widest font-mono h-16"
                  required
                  disabled={isSubmitting}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || verificationCode.length !== 6}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-5 w-5" />
                )}
                Vérifier
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User Info & Logout */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Connecté en tant que {session?.user?.email}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Utiliser un autre compte
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TOTPVerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <TOTPVerifyContent />
    </Suspense>
  );
}
