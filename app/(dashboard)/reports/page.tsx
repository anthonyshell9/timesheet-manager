'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, Download, TrendingUp, Clock, Users, DollarSign } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface ReportData {
  totalHours: number;
  totalBillableHours: number;
  totalValue: number;
  projectBreakdown: Array<{
    projectId: string;
    projectName: string;
    projectCode: string;
    color: string;
    hours: number;
    billableHours: number;
    value: number;
  }>;
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [projectId, setProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects?isActive=true');
        const data = await res.json();
        if (data.success) {
          setProjects(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
        if (projectId !== 'all') {
          params.append('projectId', projectId);
        }

        const res = await fetch(`/api/time-entries?${params}`);
        const data = await res.json();

        if (data.success) {
          // Process data for report
          const entries = data.data;
          const projectMap: Record<string, ReportData['projectBreakdown'][0]> = {};

          let totalHours = 0;
          let totalBillableHours = 0;

          entries.forEach((entry: { project: { id: string; name: string; code: string; color: string; hourlyRate?: number }; duration: number; isBillable: boolean }) => {
            const hours = entry.duration / 60;
            totalHours += hours;

            if (entry.isBillable) {
              totalBillableHours += hours;
            }

            if (!projectMap[entry.project.id]) {
              projectMap[entry.project.id] = {
                projectId: entry.project.id,
                projectName: entry.project.name,
                projectCode: entry.project.code,
                color: entry.project.color,
                hours: 0,
                billableHours: 0,
                value: 0,
              };
            }

            projectMap[entry.project.id].hours += hours;
            if (entry.isBillable) {
              projectMap[entry.project.id].billableHours += hours;
              // Assume 150 EUR/hour if no rate specified
              const rate = entry.project.hourlyRate || 150;
              projectMap[entry.project.id].value += hours * rate;
            }
          });

          const projectBreakdown = Object.values(projectMap).sort((a, b) => b.hours - a.hours);
          const totalValue = projectBreakdown.reduce((acc, p) => acc + p.value, 0);

          setReportData({
            totalHours,
            totalBillableHours,
            totalValue,
            projectBreakdown,
          });
        }
      } catch (error) {
        console.error('Failed to fetch report:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [startDate, endDate, projectId]);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    // TODO: Implement export
    console.log(`Exporting as ${format}`);
  };

  const quickRanges = [
    { label: 'Ce mois', start: startOfMonth(new Date()), end: endOfMonth(new Date()) },
    { label: '30 derniers jours', start: subDays(new Date(), 30), end: new Date() },
    { label: '7 derniers jours', start: subDays(new Date(), 7), end: new Date() },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yyyy', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span>-</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'dd/MM/yyyy', { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick ranges */}
            <div className="flex gap-2">
              {quickRanges.map((range) => (
                <Button
                  key={range.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStartDate(range.start);
                    setEndDate(range.end);
                  }}
                >
                  {range.label}
                </Button>
              ))}
            </div>

            {/* Project filter */}
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tous les projets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les projets</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export buttons */}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {reportData && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Heures</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Heures Facturables</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportData.totalBillableHours.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">
                {((reportData.totalBillableHours / reportData.totalHours) * 100 || 0).toFixed(0)}%
                du total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valeur Estimée</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reportData.totalValue.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Project Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition par Projet</CardTitle>
          <CardDescription>Détail des heures par projet sur la période</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !reportData || reportData.projectBreakdown.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune donnée pour cette période
            </p>
          ) : (
            <div className="space-y-4">
              {reportData.projectBreakdown.map((project) => (
                <div key={project.projectId} className="flex items-center gap-4">
                  <div
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{project.projectName}</span>
                        <span className="text-muted-foreground ml-2">({project.projectCode})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{project.hours.toFixed(1)}h</Badge>
                        <span className="text-sm text-muted-foreground w-24 text-right">
                          {project.value.toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: project.color,
                          width: `${(project.hours / reportData.totalHours) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
