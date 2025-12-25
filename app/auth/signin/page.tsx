'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Shield, Users } from 'lucide-react';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const handleSignIn = () => {
    signIn('azure-ad', { callbackUrl });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Clock className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            TimeSheet Manager
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestion professionnelle des feuilles de temps
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
            {error === 'AccountDisabled'
              ? 'Votre compte a été désactivé. Contactez votre administrateur.'
              : error === 'SignInError'
                ? 'Erreur lors de la connexion. Veuillez réessayer.'
                : "Une erreur s'est produite. Veuillez réessayer."}
          </div>
        )}

        {/* Sign In Card */}
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Connectez-vous avec votre compte Microsoft professionnel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button onClick={handleSignIn} className="w-full" size="lg">
              <svg className="mr-2 h-5 w-5" viewBox="0 0 21 21" fill="currentColor">
                <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
              </svg>
              Continuer avec Microsoft
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              <p>En vous connectant, vous acceptez nos</p>
              <p>
                <a href="#" className="underline hover:text-primary">
                  Conditions d&apos;utilisation
                </a>{' '}
                et notre{' '}
                <a href="#" className="underline hover:text-primary">
                  Politique de confidentialité
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xs text-muted-foreground">Suivi du temps</p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground">Collaboration</p>
          </div>
          <div className="space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xs text-muted-foreground">Sécurisé</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          MFA (Multi-Factor Authentication) obligatoire via Azure AD
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
