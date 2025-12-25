'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Play,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DashboardStats {
  totalHoursThisWeek: number;
  targetHours: number;
  pendingTimesheets: number;
  approvedTimesheets: number;
  pendingValidations: number;
  recentProjects: Array<{
    id: string;
    name: string;
    code: string;
    color: string;
    hoursThisWeek: number;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalHoursThisWeek: 0,
    targetHours: 40,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
    pendingValidations: 0,
    recentProjects: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch time entries for this week
        const entriesRes = await fetch(
          `/api/time-entries?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`
        );
        const entriesData = await entriesRes.json();

        if (entriesData.success) {
          const totalMinutes = entriesData.data.reduce(
            (acc: number, entry: { duration: number }) => acc + entry.duration,
            0
          );

          // Group by project
          const projectHours: Record<string, { name: string; code: string; color: string; minutes: number }> = {};
          entriesData.data.forEach((entry: { project: { id: string; name: string; code: string; color: string }; duration: number }) => {
            if (!projectHours[entry.project.id]) {
              projectHours[entry.project.id] = {
                name: entry.project.name,
                code: entry.project.code,
                color: entry.project.color,
                minutes: 0,
              };
            }
            projectHours[entry.project.id].minutes += entry.duration;
          });

          const recentProjects = Object.entries(projectHours)
            .map(([id, data]) => ({
              id,
              ...data,
              hoursThisWeek: data.minutes / 60,
            }))
            .sort((a, b) => b.hoursThisWeek - a.hoursThisWeek)
            .slice(0, 5);

          setStats((prev) => ({
            ...prev,
            totalHoursThisWeek: totalMinutes / 60,
            recentProjects,
          }));
        }

        // Fetch timesheets
        const timesheetsRes = await fetch('/api/timesheets?limit=100');
        const timesheetsData = await timesheetsRes.json();

        if (timesheetsData.success) {
          const pending = timesheetsData.data.filter(
            (ts: { status: string }) => ts.status === 'SUBMITTED'
          ).length;
          const approved = timesheetsData.data.filter(
            (ts: { status: string }) => ts.status === 'APPROVED'
          ).length;

          setStats((prev) => ({
            ...prev,
            pendingTimesheets: pending,
            approvedTimesheets: approved,
          }));
        }

        // Fetch pending validations for validators
        if (session?.user?.role === 'VALIDATOR' || session?.user?.role === 'ADMIN') {
          const validationsRes = await fetch('/api/approvals?status=PENDING');
          const validationsData = await validationsRes.json();

          if (validationsData.success) {
            setStats((prev) => ({
              ...prev,
              pendingValidations: validationsData.data.length,
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [session?.user?.role]);

  const progressPercentage = (stats.totalHoursThisWeek / stats.targetHours) * 100;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Bonjour, {session?.user?.name?.split(' ')[0] || 'Utilisateur'}
          </h2>
          <p className="text-muted-foreground">
            Semaine du {format(weekStart, 'd MMMM', { locale: fr })} au{' '}
            {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/time-entry">
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Saisir du temps
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Heures cette semaine</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalHoursThisWeek.toFixed(1)}h
            </div>
            <Progress value={Math.min(progressPercentage, 100)} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              sur {stats.targetHours}h objectif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimesheets}</div>
            <p className="text-xs text-muted-foreground">feuilles de temps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Validées</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedTimesheets}</div>
            <p className="text-xs text-muted-foreground">ce mois</p>
          </CardContent>
        </Card>

        {(session?.user?.role === 'VALIDATOR' || session?.user?.role === 'ADMIN') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A valider</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingValidations}</div>
              <Link href="/validations">
                <Button variant="link" className="h-auto p-0 text-xs">
                  Voir les demandes <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Projects */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projets cette semaine</CardTitle>
            <CardDescription>Répartition du temps par projet</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentProjects.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune entrée de temps cette semaine
              </p>
            ) : (
              <div className="space-y-4">
                {stats.recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center gap-4">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{project.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {project.hoursThisWeek.toFixed(1)}h
                        </span>
                      </div>
                      <Progress
                        value={(project.hoursThisWeek / stats.targetHours) * 100}
                        className="mt-1 h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>Accès directs aux fonctionnalités</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/time-entry">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="mr-2 h-4 w-4" />
                Saisir du temps
              </Button>
            </Link>
            <Link href="/timesheets">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Mes feuilles de temps
              </Button>
            </Link>
            <Link href="/calendar">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Voir le calendrier
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                Rapports et statistiques
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
