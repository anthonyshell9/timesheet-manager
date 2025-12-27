'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  User,
  Calendar,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface TimeEntry {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  duration: number;
  description: string | null;
  isBillable: boolean;
  project: { id: string; name: string; code: string; color: string };
  subProject: { id: string; name: string } | null;
}

interface Approval {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments: string | null;
  validatedAt: string | null;
  createdAt: string;
  validator: { id: string; name: string; email: string };
}

interface TimeSheet {
  id: string;
  name: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REOPENED';
  totalHours: number;
  submittedAt: string | null;
  lockedAt: string | null;
  user: { id: string; name: string; email: string; manager: { id: string; name: string; email: string } | null };
  lockedBy: { id: string; name: string } | null;
  timeEntries: TimeEntry[];
  approvals: Approval[];
  entriesByDate: Record<string, TimeEntry[]>;
  totalsByProject: Record<string, { name: string; minutes: number }>;
  canValidate: boolean;
}

const statusConfig = {
  DRAFT: { label: 'Brouillon', variant: 'secondary' as const, icon: FileText },
  SUBMITTED: { label: 'En attente', variant: 'default' as const, icon: Clock },
  APPROVED: { label: 'Approuvée', variant: 'success' as const, icon: CheckCircle },
  REJECTED: { label: 'Refusée', variant: 'destructive' as const, icon: XCircle },
  REOPENED: { label: 'Réouverte', variant: 'warning' as const, icon: RefreshCw },
};

export default function TimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();

  const [timesheet, setTimesheet] = useState<TimeSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [comments, setComments] = useState('');

  useEffect(() => {
    const fetchTimesheet = async () => {
      try {
        const res = await fetch(`/api/timesheets/${id}`);
        const data = await res.json();
        if (data.success) {
          setTimesheet(data.data);
        } else {
          toast({
            title: 'Erreur',
            description: data.error || 'Feuille de temps non trouvée',
            variant: 'destructive',
          });
          router.push('/timesheets');
        }
      } catch (error) {
        console.error('Failed to fetch timesheet:', error);
        toast({
          title: 'Erreur',
          description: 'Erreur lors du chargement',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimesheet();
  }, [id, router, toast]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/timesheets/${id}/submit`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Succès', description: 'Feuille de temps soumise' });
        setTimesheet((prev) => prev ? { ...prev, status: 'SUBMITTED', submittedAt: new Date().toISOString() } : null);
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la soumission', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: id,
          status: 'APPROVED',
          comments: comments || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Succès', description: 'Feuille de temps approuvée' });
        setTimesheet((prev) => prev ? { ...prev, status: 'APPROVED' } : null);
        setShowApproveDialog(false);
        setComments('');
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: "Erreur lors de l'approbation", variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez indiquer la raison du refus', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: id,
          status: 'REJECTED',
          comments,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Succès', description: 'Feuille de temps refusée' });
        setTimesheet((prev) => prev ? { ...prev, status: 'REJECTED' } : null);
        setShowRejectDialog(false);
        setComments('');
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors du refus', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/timesheets/${id}/reopen`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Succès', description: 'Feuille de temps réouverte' });
        setTimesheet((prev) => prev ? { ...prev, status: 'REOPENED' } : null);
        setShowReopenDialog(false);
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la réouverture', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!timesheet) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Feuille de temps non trouvée</p>
        <Link href="/timesheets">
          <Button className="mt-4">Retour aux feuilles de temps</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[timesheet.status];
  const StatusIcon = status.icon;
  const isOwner = timesheet.user.id === session?.user?.id;
  const isAdmin = session?.user?.role === 'ADMIN';
  const isValidator = session?.user?.role === 'VALIDATOR';
  const isManager = timesheet.user.manager?.id === session?.user?.id;
  const canSubmit = isOwner && ['DRAFT', 'REOPENED'].includes(timesheet.status);
  const canApprove = (timesheet.canValidate || isAdmin) && timesheet.status === 'SUBMITTED';
  // Only managers, validators, and admins can reopen (not the owner)
  const canReopen = (isAdmin || isValidator || isManager || timesheet.canValidate) &&
                    ['APPROVED', 'REJECTED'].includes(timesheet.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/timesheets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {timesheet.name || `Feuille du ${format(new Date(timesheet.createdAt), 'd MMM yyyy', { locale: fr })}`}
            </h1>
            <p className="text-muted-foreground">
              Créée le {format(new Date(timesheet.createdAt), 'd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={status.variant} className="gap-1 px-3 py-1 text-sm">
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </Badge>

          {canSubmit && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Soumettre
            </Button>
          )}

          {canApprove && (
            <>
              <Button onClick={() => setShowApproveDialog(true)} variant="default">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approuver
              </Button>
              <Button onClick={() => setShowRejectDialog(true)} variant="destructive">
                <XCircle className="mr-2 h-4 w-4" />
                Refuser
              </Button>
            </>
          )}

          {canReopen && (
            <Button onClick={() => setShowReopenDialog(true)} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Réouvrir
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Number(timesheet.totalHours).toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Total heures</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{timesheet.timeEntries.length}</p>
                <p className="text-xs text-muted-foreground">Entrées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{timesheet.user.name}</p>
                <p className="text-xs text-muted-foreground">{timesheet.user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {Object.keys(timesheet.entriesByDate).length} jours
                </p>
                <p className="text-xs text-muted-foreground">de travail</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Totals by Project */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition par projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(timesheet.totalsByProject).map(([projectId, data]) => (
              <div key={projectId} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{data.name}</span>
                <Badge variant="outline">{(data.minutes / 60).toFixed(1)}h</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Entries by Date */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des entrées</CardTitle>
          <CardDescription>Entrées de temps groupées par jour</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(timesheet.entriesByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, entries]) => {
              const dayTotal = entries.reduce((acc, e) => acc + e.duration, 0);
              return (
                <div key={date}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">
                      {format(new Date(date), 'EEEE d MMMM', { locale: fr })}
                    </h3>
                    <Badge variant="secondary">{(dayTotal / 60).toFixed(1)}h</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projet</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Durée</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: entry.project.color }}
                              />
                              <span>{entry.project.name}</span>
                              {entry.subProject && (
                                <span className="text-muted-foreground">/ {entry.subProject.name}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {entry.description || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.floor(entry.duration / 60)}h
                            {entry.duration % 60 > 0 ? ` ${entry.duration % 60}min` : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Approval History */}
      {timesheet.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Historique des validations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timesheet.approvals.map((approval) => (
                <div key={approval.id} className="flex items-start gap-4 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{approval.validator.name}</span>
                      <Badge
                        variant={
                          approval.status === 'APPROVED'
                            ? 'success'
                            : approval.status === 'REJECTED'
                            ? 'destructive'
                            : 'default'
                        }
                      >
                        {approval.status === 'APPROVED'
                          ? 'Approuvé'
                          : approval.status === 'REJECTED'
                          ? 'Refusé'
                          : 'En attente'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {approval.validatedAt
                        ? format(new Date(approval.validatedAt), 'd MMMM yyyy à HH:mm', { locale: fr })
                        : format(new Date(approval.createdAt), 'd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                    {approval.comments && (
                      <p className="mt-2 text-sm">{approval.comments}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver la feuille de temps</DialogTitle>
            <DialogDescription>
              Vous allez approuver cette feuille de temps. Vous pouvez ajouter un commentaire optionnel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Commentaire (optionnel)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleApprove} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la feuille de temps</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du refus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Raison du refus (obligatoire)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting || !comments.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réouvrir la feuille de temps</DialogTitle>
            <DialogDescription>
              Cette action permettra de modifier à nouveau les entrées de temps.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleReopen} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Réouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
