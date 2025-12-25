'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <ShieldX className="h-8 w-8 text-warning" />
            </div>
            <CardTitle className="mt-4">Accès non autorisé</CardTitle>
            <CardDescription>
              Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez votre
              administrateur pour demander les accès appropriés.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/dashboard" className="flex-1">
                <Button className="w-full" variant="default">
                  <Home className="mr-2 h-4 w-4" />
                  Tableau de bord
                </Button>
              </Link>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
