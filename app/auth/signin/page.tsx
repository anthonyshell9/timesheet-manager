'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Shield, Users, Loader2 } from 'lucide-react';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleAzureSignIn = () => {
    setIsLoading(true);
    signIn('azure-ad', { callbackUrl });
  };

  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLocalError(null);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setLocalError(result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        // Check if TOTP is required
        router.push(callbackUrl);
      }
    } catch (err) {
      setLocalError('Erreur de connexion. Veuillez réessayer.');
      setIsLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'AccessDenied':
        return 'Accès refusé. Votre compte doit être créé par un administrateur avant de pouvoir vous connecter.';
      case 'AccountDisabled':
        return 'Votre compte a été désactivé. Contactez votre administrateur.';
      case 'SignInError':
        return 'Erreur lors de la connexion. Veuillez réessayer.';
      case 'CredentialsSignin':
        return 'Identifiants invalides.';
      default:
        return errorCode ? 'Une erreur s\'est produite. Veuillez réessayer.' : null;
    }
  };

  const displayError = localError || getErrorMessage(error);

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
        {displayError && (
          <div className="rounded-md bg-destructive/10 p-4 text-center text-sm text-destructive">
            {displayError}
          </div>
        )}

        {/* Sign In Card */}
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Choisissez votre méthode de connexion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="microsoft" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="microsoft">Microsoft</TabsTrigger>
                <TabsTrigger value="local">Email / Mot de passe</TabsTrigger>
              </TabsList>

              <TabsContent value="microsoft" className="space-y-4 pt-4">
                <Button
                  onClick={handleAzureSignIn}
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 21 21" fill="currentColor">
                      <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
                    </svg>
                  )}
                  Continuer avec Microsoft
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Réservé aux comptes Microsoft professionnels pré-autorisés
                </p>
              </TabsContent>

              <TabsContent value="local" className="space-y-4 pt-4">
                <form onSubmit={handleLocalSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Shield className="mr-2 h-5 w-5" />
                    )}
                    Se connecter
                  </Button>
                </form>
                <p className="text-center text-xs text-muted-foreground">
                  MFA obligatoire pour les comptes locaux
                </p>
              </TabsContent>
            </Tabs>
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
          Authentification sécurisée avec MFA
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
