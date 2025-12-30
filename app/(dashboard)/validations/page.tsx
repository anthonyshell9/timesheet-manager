'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle, XCircle, Clock, Eye, RefreshCw, FileText, Users, AlertTriangle, CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface Approval {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment: string | null;
  createdAt: string;
  timesheet: {
    id: string;
    name: string | null;
    createdAt: string;
    periodStart: string | null;
    periodEnd: string | null;
    status: string;
    totalHours: number;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  hasSubmittedThisWeek: boolean;
  hasSubmittedThisMonth: boolean;
  lastTimesheetDate: string | null;
  totalHoursThisWeek: number;
  pendingTimesheet: { id: string; totalHours: number } | null;
}

export default function ValidationsPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  // Team status
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);

  // Team filters
  const [teamStartDate, setTeamStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [teamEndDate, setTeamEndDate] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const [teamUserId, setTeamUserId] = useState<string>('all');

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

  // Fetch team status with filters
  const fetchTeamStatus = async () => {
    setIsLoadingTeam(true);
    try {
      const params = new URLSearchParams({
        startDate: teamStartDate.toISOString(),
        endDate: teamEndDate.toISOString(),
      });
      if (teamUserId !== 'all') {
        params.append('userId', teamUserId);
      }

      const res = await fetch(`/api/team/status?${params}`);
      const data = await res.json();
      if (data.success) {
        setTeamMembers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch team status:', error);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  // Fetch all team members for the filter dropdown (without date filter)
  const fetchAllTeamMembers = async () => {
    try {
      const res = await fetch('/api/team/status');
      const data = await res.json();
      if (data.success) {
        setAllTeamMembers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch all team members:', error);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'ADMIN' || session?.user?.role === 'VALIDATOR') {
      fetchAllTeamMembers();
    }
  }, [session]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN' || session?.user?.role === 'VALIDATOR') {
      fetchTeamStatus();
    }
  }, [session, teamStartDate, teamEndDate, teamUserId]);

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
            dialogAction === 'approve' ? 'Feuille de temps approuvée' : 'Feuille de temps refusée',
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
  const missingTimesheetCount = teamMembers.filter((m) => !m.hasSubmittedThisWeek && !m.pendingTimesheet).length;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals" className="gap-2">
            <FileText className="h-4 w-4" />
            Validations
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Suivi équipe
            {missingTimesheetCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {missingTimesheetCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-6">
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
        <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
          Toutes
        </Button>
      </div>

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Demandes de validation</CardTitle>
          <CardDescription>Feuilles de temps en attente de votre validation</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : approvals.length === 0 ? (
            <div className="py-8 text-center">
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
                      <div className="font-medium">
                        {approval.timesheet.name ||
                          format(new Date(approval.timesheet.createdAt), 'd MMM yyyy', {
                            locale: fr,
                          })}
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
              {dialogAction === 'approve'
                ? 'Approuver la feuille de temps'
                : 'Refuser la feuille de temps'}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval && (
                <>
                  Feuille de temps de {selectedApproval.timesheet.user.name} (
                  {Number(selectedApproval.timesheet.totalHours).toFixed(1)}h)
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
        </TabsContent>

        {/* Team Status Tab */}
        <TabsContent value="team" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtres</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(teamStartDate, 'dd/MM/yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={teamStartDate}
                        onSelect={(d) => d && setTeamStartDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span>-</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(teamEndDate, 'dd/MM/yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={teamEndDate}
                        onSelect={(d) => d && setTeamEndDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Quick ranges */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTeamStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
                      setTeamEndDate(endOfWeek(new Date(), { weekStartsOn: 1 }));
                    }}
                  >
                    Cette semaine
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTeamStartDate(startOfMonth(new Date()));
                      setTeamEndDate(endOfMonth(new Date()));
                    }}
                  >
                    Ce mois
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTeamStartDate(subDays(new Date(), 30));
                      setTeamEndDate(new Date());
                    }}
                  >
                    30 derniers jours
                  </Button>
                </div>

                {/* User filter */}
                <Select value={teamUserId} onValueChange={setTeamUserId}>
                  <SelectTrigger className="w-[200px]">
                    <Users className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Tous les collaborateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les collaborateurs</SelectItem>
                    {allTeamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Suivi des feuilles de temps de l'équipe
              </CardTitle>
              <CardDescription>
                Du {format(teamStartDate, 'd MMMM', { locale: fr })} au{' '}
                {format(teamEndDate, 'd MMMM yyyy', { locale: fr })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTeam ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">Aucun membre d'équipe</h3>
                  <p className="text-muted-foreground">
                    Aucun collaborateur n'est assigné à votre équipe
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collaborateur</TableHead>
                      <TableHead>Statut semaine</TableHead>
                      <TableHead>Heures (période)</TableHead>
                      <TableHead>Dernière FDT</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </TableCell>
                        <TableCell>
                          {member.pendingTimesheet ? (
                            <Badge variant="default" className="gap-1">
                              <Clock className="h-3 w-3" />
                              En attente
                            </Badge>
                          ) : member.hasSubmittedThisWeek ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Soumise
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Non soumise
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={member.totalHoursThisWeek < 35 ? 'text-orange-500' : ''}>
                            {member.totalHoursThisWeek.toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell>
                          {member.lastTimesheetDate
                            ? format(new Date(member.lastTimesheetDate), 'dd/MM/yyyy', { locale: fr })
                            : <span className="text-muted-foreground">Jamais</span>
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {member.pendingTimesheet && (
                            <Link href={`/timesheets/${member.pendingTimesheet.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="mr-2 h-4 w-4" />
                                Voir ({member.pendingTimesheet.totalHours.toFixed(1)}h)
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total équipe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamMembers.length}</div>
                <p className="text-xs text-muted-foreground">collaborateurs</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">FDT soumises</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {teamMembers.filter((m) => m.hasSubmittedThisWeek || m.pendingTimesheet).length}
                </div>
                <p className="text-xs text-muted-foreground">cette semaine</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">En attente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{missingTimesheetCount}</div>
                <p className="text-xs text-muted-foreground">pas de soumission</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
