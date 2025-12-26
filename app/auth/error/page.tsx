'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Erreur de configuration',
    description: "Le serveur d'authentification n'est pas correctement configuré.",
  },
  AccessDenied: {
    title: 'Accès refusé',
    description: "Vous n'avez pas les permissions nécessaires pour accéder à cette application.",
  },
  Verification: {
    title: 'Erreur de vérification',
    description:
      "Le lien de vérification a expiré ou a déjà été utilisé. Veuillez demander un nouveau lien.",
  },
  AccountDisabled: {
    title: 'Compte désactivé',
    description: 'Votre compte a été désactivé. Veuillez contacter votre administrateur.',
  },
  SignInError: {
    title: 'Erreur de connexion',
    description:
      "Une erreur s'est produite lors de la connexion. Veuillez réessayer ou contacter le support.",
  },
  Default: {
    title: 'Erreur de connexion',
    description:
      "Une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support.",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const errorInfo = errorMessages[error] ?? errorMessages['Default']!;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="mt-4">{errorInfo.title}</CardTitle>
            <CardDescription>{errorInfo.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/auth/signin" className="block">
              <Button className="w-full" variant="default">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la connexion
              </Button>
            </Link>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Si le problème persiste, contactez le support technique.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Code erreur: {error}
        </p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
