'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import Image from 'next/image';

export default function TOTPSetupPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCode: string;
    otpauthUrl: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchSetupData();
    }
  }, [status, router]);

  const fetchSetupData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/totp/setup');
      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'TOTP est déjà activé pour ce compte') {
          router.push('/dashboard');
          return;
        }
        throw new Error(data.error || 'Erreur lors de la configuration');
      }

      setSetupData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (setupData?.secret) {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Code invalide');
      }

      setSuccess(true);

      // Update session to reflect TOTP enabled
      await update();

      // Force full page reload to refresh middleware state
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de vérification');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">MFA Activé!</h2>
              <p className="text-muted-foreground">
                L'authentification à deux facteurs est maintenant active sur votre compte.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirection vers le tableau de bord...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Configuration MFA
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sécurisez votre compte avec l'authentification à deux facteurs
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Setup Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Étape 1: Scanner le QR Code</CardTitle>
            <CardDescription>
              Utilisez votre application d'authentification (Google Authenticator, Microsoft
              Authenticator, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            {setupData?.qrCode && (
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-4">
                  <img
                    src={setupData.qrCode}
                    alt="QR Code pour l'authentification"
                    width={200}
                    height={200}
                  />
                </div>
              </div>
            )}

            {/* Manual Secret */}
            <div className="space-y-2">
              <Label>Ou entrez ce code manuellement:</Label>
              <div className="flex gap-2">
                <Input value={setupData?.secret || ''} readOnly className="font-mono text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopySecret}>
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Étape 2: Vérifier le code</CardTitle>
            <CardDescription>
              Entrez le code à 6 chiffres affiché dans votre application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code de vérification</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center font-mono text-2xl tracking-widest"
                  required
                  disabled={isSubmitting}
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
                Activer MFA
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info */}
        <p className="text-center text-xs text-muted-foreground">
          La configuration MFA est obligatoire pour les comptes locaux
        </p>
      </div>
    </div>
  );
}
