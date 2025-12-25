'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Play, Pause, Square, CalendarIcon, Clock, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  subProjects: Array<{ id: string; name: string }>;
}

interface TimeEntry {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  duration: number;
  description: string | null;
  project: { id: string; name: string; code: string; color: string };
  subProject: { id: string; name: string } | null;
}

export default function TimeEntryPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [date, setDate] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState('');
  const [subProjectId, setSubProjectId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);

  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  const selectedProject = projects.find((p) => p.id === projectId);

  // Fetch projects
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

  // Fetch today's entries
  const fetchTodayEntries = useCallback(async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await fetch(`/api/time-entries?startDate=${today}&endDate=${today}`);
      const data = await res.json();
      if (data.success) {
        setTodayEntries(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  }, []);

  useEffect(() => {
    fetchTodayEntries();
  }, [fetchTodayEntries]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    if (!projectId) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un projet',
        variant: 'destructive',
      });
      return;
    }
    setIsTimerRunning(true);
    setTimerStartTime(new Date());
    setTimerSeconds(0);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleStopTimer = async () => {
    if (timerSeconds < 60) {
      toast({
        title: 'Erreur',
        description: 'La durée minimale est de 1 minute',
        variant: 'destructive',
      });
      return;
    }

    setIsTimerRunning(false);
    const duration = Math.round(timerSeconds / 60);

    await saveTimeEntry({
      date: format(date, 'yyyy-MM-dd'),
      projectId,
      subProjectId: subProjectId || undefined,
      startTime: timerStartTime ? format(timerStartTime, 'HH:mm') : undefined,
      endTime: format(new Date(), 'HH:mm'),
      duration,
      description: description || undefined,
      isBillable,
      isTimerEntry: true,
    });

    setTimerSeconds(0);
    setTimerStartTime(null);
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un projet',
        variant: 'destructive',
      });
      return;
    }

    let duration = 0;
    if (startTime && endTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      duration = (endH! - startH!) * 60 + (endM! - startM!);
    }

    if (duration <= 0) {
      toast({
        title: 'Erreur',
        description: 'La durée doit être positive',
        variant: 'destructive',
      });
      return;
    }

    await saveTimeEntry({
      date: format(date, 'yyyy-MM-dd'),
      projectId,
      subProjectId: subProjectId || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      duration,
      description: description || undefined,
      isBillable,
      isTimerEntry: false,
    });
  };

  const saveTimeEntry = async (data: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.success) {
        toast({
          title: 'Succès',
          description: 'Entrée de temps enregistrée',
        });
        // Reset form
        setStartTime('');
        setEndTime('');
        setDescription('');
        fetchTodayEntries();
      } else {
        toast({
          title: 'Erreur',
          description: result.error || 'Erreur lors de l\'enregistrement',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
      const result = await res.json();

      if (result.success) {
        toast({ title: 'Succès', description: 'Entrée supprimée' });
        fetchTodayEntries();
      } else {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  const totalToday = todayEntries.reduce((acc, entry) => acc + entry.duration, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Chronomètre
            </CardTitle>
            <CardDescription>Démarrez le chronomètre pour enregistrer votre temps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="font-mono text-5xl font-bold tabular-nums">
                {formatTimer(timerSeconds)}
              </div>
            </div>

            <div className="flex justify-center gap-2">
              {!isTimerRunning ? (
                <Button onClick={handleStartTimer} size="lg" className="gap-2">
                  <Play className="h-5 w-5" />
                  Démarrer
                </Button>
              ) : (
                <>
                  <Button onClick={handlePauseTimer} size="lg" variant="outline" className="gap-2">
                    <Pause className="h-5 w-5" />
                    Pause
                  </Button>
                  <Button onClick={handleStopTimer} size="lg" variant="destructive" className="gap-2">
                    <Square className="h-5 w-5" />
                    Arrêter
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Projet</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name} ({project.code})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProject && selectedProject.subProjects.length > 0 && (
                <div className="space-y-2">
                  <Label>Sous-projet</Label>
                  <Select value={subProjectId} onValueChange={setSubProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un sous-projet" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProject.subProjects.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre travail..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="billable-timer"
                  checked={isBillable}
                  onCheckedChange={(checked) => setIsBillable(checked as boolean)}
                />
                <label htmlFor="billable-timer" className="text-sm">
                  Temps facturable
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Entry Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Saisie manuelle
            </CardTitle>
            <CardDescription>Ajoutez une entrée de temps manuellement</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualEntry} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'PPP', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heure début</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure fin</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Projet</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProject && selectedProject.subProjects.length > 0 && (
                <div className="space-y-2">
                  <Label>Sous-projet</Label>
                  <Select value={subProjectId} onValueChange={setSubProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optionnel" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProject.subProjects.map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          {sp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre travail..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="billable"
                  checked={isBillable}
                  onCheckedChange={(checked) => setIsBillable(checked as boolean)}
                />
                <label htmlFor="billable" className="text-sm">
                  Temps facturable
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Today's Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entrées du jour</CardTitle>
              <CardDescription>
                {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg">
              {(totalToday / 60).toFixed(1)}h
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {todayEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune entrée pour aujourd'hui
            </p>
          ) : (
            <div className="space-y-2">
              {todayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: entry.project.color }}
                    />
                    <div>
                      <div className="font-medium">
                        {entry.project.name}
                        {entry.subProject && (
                          <span className="text-muted-foreground">
                            {' '}/ {entry.subProject.name}
                          </span>
                        )}
                      </div>
                      {entry.description && (
                        <div className="text-sm text-muted-foreground">
                          {entry.description}
                        </div>
                      )}
                      {entry.startTime && entry.endTime && (
                        <div className="text-xs text-muted-foreground">
                          {entry.startTime} - {entry.endTime}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{(entry.duration / 60).toFixed(1)}h</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
