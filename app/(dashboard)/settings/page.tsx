'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { User, Shield, Key, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSettingUpTOTP, setIsSettingUpTOTP] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSetupTOTP = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/totp/setup');
      const data = await res.json();

      if (data.success) {
        setTotpSetupData(data.data);
        setIsSettingUpTOTP(true);
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur lors de la configuration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la configuration MFA',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyTOTP = async () => {
    if (verificationCode.length !== 6) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'MFA activé avec succès',
        });
        setIsSettingUpTOTP(false);
        setTotpSetupData(null);
        setVerificationCode('');
        // Refresh session
        await update();
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Code invalide',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur de vérification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'Mot de passe modifié avec succès',
        });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur lors du changement de mot de passe',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors du changement de mot de passe',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const roleLabels = {
    ADMIN: 'Administrateur',
    VALIDATOR: 'Validateur',
    USER: 'Utilisateur',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres du compte</h1>
        <p className="text-muted-foreground">Gérez votre profil et la sécurité de votre compte</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du profil</CardTitle>
              <CardDescription>Vos informations de compte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={session?.user?.name || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={session?.user?.email || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <div>
                    <Badge>{roleLabels[session?.user?.role as keyof typeof roleLabels] || 'Utilisateur'}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Type de compte</Label>
                  <div className="flex gap-2">
                    {session?.user?.isLocalAccount ? (
                      <Badge variant="outline">Compte local</Badge>
                    ) : (
                      <Badge variant="outline">Microsoft</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {/* MFA Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Authentification à deux facteurs (MFA)
              </CardTitle>
              <CardDescription>
                Sécurisez votre compte avec une application d'authentification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!session?.user?.isLocalAccount ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Votre compte Microsoft utilise déjà l'authentification Microsoft</span>
                </div>
              ) : isSettingUpTOTP && totpSetupData ? (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="rounded-lg border bg-white p-4">
                      <img
                        src={totpSetupData.qrCode}
                        alt="QR Code"
                        width={200}
                        height={200}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Scannez ce code avec votre application d'authentification
                    </p>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {totpSetupData.secret}
                    </code>
                  </div>
                  <div className="space-y-2">
                    <Label>Code de vérification</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className="text-center text-xl tracking-widest font-mono"
                      />
                      <Button
                        onClick={handleVerifyTOTP}
                        disabled={isLoading || verificationCode.length !== 6}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vérifier'}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setIsSettingUpTOTP(false)}>
                    Annuler
                  </Button>
                </div>
              ) : session?.user?.totpEnabled ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>MFA activé</span>
                  </div>
                  <Badge variant="default">Actif</Badge>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                    <span>MFA non configuré - Votre compte est moins sécurisé</span>
                  </div>
                  <Button onClick={handleSetupTOTP} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="mr-2 h-4 w-4" />
                    )}
                    Configurer MFA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Password Change Section - Only for local accounts */}
          {session?.user?.isLocalAccount && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Changer le mot de passe
                </CardTitle>
                <CardDescription>
                  Modifiez votre mot de passe de connexion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4" />
                    )}
                    Changer le mot de passe
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
