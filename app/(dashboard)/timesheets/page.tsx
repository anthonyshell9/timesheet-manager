'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import Link from 'next/link';

interface TimeSheet {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REOPENED';
  totalHours: number;
  submittedAt: string | null;
  lockedAt: string | null;
  user: { id: string; name: string; email: string };
  _count: { timeEntries: number; approvals: number };
}

const statusConfig = {
  DRAFT: { label: 'Brouillon', variant: 'secondary' as const, icon: FileText },
  SUBMITTED: { label: 'Soumis', variant: 'default' as const, icon: Clock },
  APPROVED: { label: 'Approuvé', variant: 'success' as const, icon: CheckCircle },
  REJECTED: { label: 'Refusé', variant: 'destructive' as const, icon: XCircle },
  REOPENED: { label: 'Rouvert', variant: 'warning' as const, icon: RefreshCw },
};

export default function TimesheetsPage() {
  const { toast } = useToast();
  const [timesheets, setTimesheets] = useState<TimeSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      <Card>
        <CardHeader>
          <CardTitle>Mes feuilles de temps</CardTitle>
          <CardDescription>
            Gérez et soumettez vos feuilles de temps hebdomadaires
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Aucune feuille de temps</h3>
              <p className="text-muted-foreground">
                Commencez à saisir du temps pour créer une feuille
              </p>
              <Link href="/time-entry">
                <Button className="mt-4">Saisir du temps</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Entrées</TableHead>
                  <TableHead>Soumis le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((timesheet) => {
                  const status = statusConfig[timesheet.status];
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <div className="font-medium">
                          Semaine du {format(new Date(timesheet.weekStart), 'd MMM', { locale: fr })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(timesheet.weekStart), 'd MMM', { locale: fr })} -{' '}
                          {format(new Date(timesheet.weekEnd), 'd MMM yyyy', { locale: fr })}
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
