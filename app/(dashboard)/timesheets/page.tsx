'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  MoreHorizontal,
  Eye,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

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
  user: { id: string; name: string; email: string };
  _count: { timeEntries: number; approvals: number };
}

const statusConfig = {
  DRAFT: { label: 'Brouillon', variant: 'secondary' as const, icon: FileText },
  SUBMITTED: { label: 'En attente', variant: 'default' as const, icon: Clock },
  APPROVED: { label: 'Approuvée', variant: 'success' as const, icon: CheckCircle },
  REJECTED: { label: 'Refusée', variant: 'destructive' as const, icon: XCircle },
  REOPENED: { label: 'Réouverte', variant: 'warning' as const, icon: RefreshCw },
};

export default function TimesheetsPage() {
  const { toast } = useToast();
  const [timesheets, setTimesheets] = useState<TimeSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchTimesheets = async () => {
    try {
      const res = await fetch('/api/timesheets');
      const data = await res.json();
      if (data.success) {
        setTimesheets(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch timesheets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets();
  }, []);

  // Filter timesheets by status
  const filteredTimesheets = useMemo(() => {
    if (statusFilter === 'all') return timesheets;
    return timesheets.filter((t) => t.status === statusFilter);
  }, [timesheets, statusFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const drafts = timesheets.filter((t) => t.status === 'DRAFT' || t.status === 'REOPENED').length;
    const pending = timesheets.filter((t) => t.status === 'SUBMITTED').length;
    const approved = timesheets.filter((t) => t.status === 'APPROVED').length;
    const rejected = timesheets.filter((t) => t.status === 'REJECTED').length;
    const totalHours = timesheets.reduce((acc, t) => acc + Number(t.totalHours), 0);

    return { drafts, pending, approved, rejected, totalHours };
  }, [timesheets]);

  const handleSubmit = async (id: string) => {
    try {
      const res = await fetch(`/api/timesheets/${id}/submit`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Succès', description: 'Feuille de temps soumise' });
        fetchTimesheets();
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
        description: 'Erreur lors de la soumission',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.drafts}</p>
                <p className="text-xs text-muted-foreground">Brouillons</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approuvées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Refusées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalHours.toFixed(0)}h</p>
                <p className="text-xs text-muted-foreground">Total heures</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Mes feuilles de temps</CardTitle>
              <CardDescription>
                Gérez et soumettez vos feuilles de temps
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="DRAFT">Brouillons</SelectItem>
                  <SelectItem value="SUBMITTED">En attente</SelectItem>
                  <SelectItem value="APPROVED">Approuvées</SelectItem>
                  <SelectItem value="REJECTED">Refusées</SelectItem>
                  <SelectItem value="REOPENED">Réouvertes</SelectItem>
                </SelectContent>
              </Select>
              <Link href="/time-entry">
                <Button>Saisir du temps</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTimesheets.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">
                {statusFilter === 'all' ? 'Aucune feuille de temps' : 'Aucune feuille avec ce statut'}
              </h3>
              <p className="text-muted-foreground">
                {statusFilter === 'all'
                  ? 'Commencez à saisir du temps pour créer une feuille'
                  : 'Essayez de changer le filtre'}
              </p>
              {statusFilter === 'all' && (
                <Link href="/time-entry">
                  <Button className="mt-4">Saisir du temps</Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feuille de temps</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Entrées</TableHead>
                  <TableHead>Soumis le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimesheets.map((timesheet) => {
                  const status = statusConfig[timesheet.status];
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <div className="font-medium">
                          {timesheet.name || `Feuille du ${format(new Date(timesheet.createdAt), 'd MMM yyyy', { locale: fr })}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Créée le {format(new Date(timesheet.createdAt), 'd MMM yyyy HH:mm', { locale: fr })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{Number(timesheet.totalHours).toFixed(1)}h</span>
                      </TableCell>
                      <TableCell>{timesheet._count.timeEntries}</TableCell>
                      <TableCell>
                        {timesheet.submittedAt
                          ? format(new Date(timesheet.submittedAt), 'dd/MM/yyyy HH:mm', {
                              locale: fr,
                            })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/timesheets/${timesheet.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Voir détails
                              </Link>
                            </DropdownMenuItem>
                            {['DRAFT', 'REOPENED'].includes(timesheet.status) && (
                              <DropdownMenuItem onClick={() => handleSubmit(timesheet.id)}>
                                <Send className="mr-2 h-4 w-4" />
                                Soumettre
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
