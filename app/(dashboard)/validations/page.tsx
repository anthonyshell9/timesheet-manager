'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

interface Approval {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment: string | null;
  createdAt: string;
  timesheet: {
    id: string;
    weekStart: string;
    weekEnd: string;
    status: string;
    totalHours: number;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export default function ValidationsPage() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  const fetchApprovals = async () => {
    try {
      const url = filter === 'all' ? '/api/approvals' : `/api/approvals?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setApprovals(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [filter]);

  const handleAction = async () => {
    if (!selectedApproval || !dialogAction) return;

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timesheetId: selectedApproval.timesheet.id,
          status: dialogAction === 'approve' ? 'APPROVED' : 'REJECTED',
          comment: comment || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description:
            dialogAction === 'approve'
              ? 'Feuille de temps approuvée'
              : 'Feuille de temps refusée',
        });
        setSelectedApproval(null);
        setDialogAction(null);
        setComment('');
        fetchApprovals();
      } else {
        toast({
          title: 'Erreur',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors du traitement',
        variant: 'destructive',
      });
    }
  };

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'PENDING' ? 'default' : 'outline'}
          onClick={() => setFilter('PENDING')}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          En attente
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pendingCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={filter === 'APPROVED' ? 'default' : 'outline'}
          onClick={() => setFilter('APPROVED')}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Approuvées
        </Button>
        <Button
          variant={filter === 'REJECTED' ? 'default' : 'outline'}
          onClick={() => setFilter('REJECTED')}
          className="gap-2"
        >
          <XCircle className="h-4 w-4" />
          Refusées
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Toutes
        </Button>
      </div>

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Demandes de validation</CardTitle>
          <CardDescription>
            Feuilles de temps en attente de votre validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Aucune demande</h3>
              <p className="text-muted-foreground">
                {filter === 'PENDING'
                  ? 'Aucune feuille de temps en attente de validation'
                  : 'Aucune demande correspondant à ce filtre'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell>
                      <div className="font-medium">{approval.timesheet.user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {approval.timesheet.user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {format(new Date(approval.timesheet.weekStart), 'd MMM', { locale: fr })}
                        {' - '}
                        {format(new Date(approval.timesheet.weekEnd), 'd MMM yyyy', { locale: fr })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {Number(approval.timesheet.totalHours).toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          approval.status === 'APPROVED'
                            ? 'success'
                            : approval.status === 'REJECTED'
                              ? 'destructive'
                              : 'default'
                        }
                      >
                        {approval.status === 'PENDING'
                          ? 'En attente'
                          : approval.status === 'APPROVED'
                            ? 'Approuvé'
                            : 'Refusé'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(approval.createdAt), 'dd/MM/yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/timesheets/${approval.timesheet.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {approval.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => {
                                setSelectedApproval(approval);
                                setDialogAction('approve');
                              }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                setSelectedApproval(approval);
                                setDialogAction('reject');
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog
        open={!!selectedApproval && !!dialogAction}
        onOpenChange={() => {
          setSelectedApproval(null);
          setDialogAction(null);
          setComment('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'approve' ? 'Approuver la feuille de temps' : 'Refuser la feuille de temps'}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval && (
                <>
                  Feuille de temps de {selectedApproval.timesheet.user.name} pour la semaine du{' '}
                  {format(new Date(selectedApproval.timesheet.weekStart), 'd MMMM yyyy', {
                    locale: fr,
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Commentaire {dialogAction === 'reject' && '(obligatoire)'}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  dialogAction === 'reject'
                    ? 'Indiquez la raison du refus...'
                    : 'Ajouter un commentaire (optionnel)...'
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedApproval(null);
                setDialogAction(null);
                setComment('');
              }}
            >
              Annuler
            </Button>
            <Button
              variant={dialogAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={dialogAction === 'reject' && !comment}
            >
              {dialogAction === 'approve' ? 'Approuver' : 'Refuser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
