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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Clock, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

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

const QUICK_DURATIONS = [
  { label: '15min', minutes: 15 },
  { label: '30min', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
  { label: '8h', minutes: 480 },
];

export default function TimeEntryPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState('');
  const [subProjectId, setSubProjectId] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');

  // Validation state
  const [errors, setErrors] = useState<{ project?: string; duration?: string }>({});

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

  // Fetch entries for selected date
  const fetchEntries = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch(`/api/time-entries?startDate=${dateStr}&endDate=${dateStr}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleQuickAdd = async (durationMinutes: number) => {
    const newErrors: { project?: string; duration?: string } = {};

    if (!projectId) {
      newErrors.project = 'Veuillez sélectionner un projet';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Erreur',
        description: 'Veuillez corriger les erreurs',
        variant: 'destructive',
      });
      return;
    }

    setErrors({});
    await saveTimeEntry(durationMinutes);
  };

  const handleManualAdd = async () => {
    const newErrors: { project?: string; duration?: string } = {};

    if (!projectId) {
      newErrors.project = 'Veuillez sélectionner un projet';
    }

    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const duration = h * 60 + m;

    if (duration <= 0) {
      newErrors.duration = 'La durée doit être supérieure à 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Erreur',
        description: 'Veuillez corriger les erreurs',
        variant: 'destructive',
      });
      return;
    }

    setErrors({});
    await saveTimeEntry(duration);
  };

  const saveTimeEntry = async (duration: number) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          projectId,
          subProjectId: subProjectId || undefined,
          duration,
          description: description || undefined,
          isBillable: true,
          isTimerEntry: false,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast({ title: 'Temps ajouté' });
        setHours('');
        setMinutes('');
        setDescription('');
        fetchEntries();
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
        description: "Erreur lors de l'enregistrement",
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
        toast({ title: 'Entrée supprimée' });
        fetchEntries();
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

  const totalMinutes = entries.reduce((acc, entry) => acc + entry.duration, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Date Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={goToPreviousDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <div className="text-lg font-semibold">
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </div>
              {!isToday && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={goToToday}
                  className="text-muted-foreground"
                >
                  Retour à aujourd'hui
                </Button>
              )}
            </div>

            <Button variant="outline" size="icon" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Add Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ajouter du temps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Projet *</Label>
            <Select
              value={projectId}
              onValueChange={(val) => {
                setProjectId(val);
                setSubProjectId('');
                if (errors.project) setErrors((prev) => ({ ...prev, project: undefined }));
              }}
            >
              <SelectTrigger className={errors.project ? 'border-destructive' : ''}>
                <SelectValue placeholder="Choisir un projet" />
              </SelectTrigger>
              <SelectContent>
                {projects
                  .filter((project) => project.id && project.id.trim() !== '')
                  .map((project) => (
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
            {errors.project && (
              <p className="text-sm text-destructive">{errors.project}</p>
            )}
          </div>

          {/* Sub-project Selection */}
          {selectedProject && selectedProject.subProjects.length > 0 && (
            <div className="space-y-2">
              <Label>Sous-projet</Label>
              <Select
                value={subProjectId || 'none'}
                onValueChange={(val) => setSubProjectId(val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optionnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {selectedProject.subProjects
                    .filter((sp) => sp.id && sp.id.trim() !== '')
                    .map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qu'avez-vous fait ?"
              rows={2}
            />
          </div>

          {/* Quick Duration Buttons */}
          <div className="space-y-2">
            <Label>Durée rapide</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_DURATIONS.map((d) => (
                <Button
                  key={d.minutes}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAdd(d.minutes)}
                  disabled={isLoading || !projectId}
                >
                  + {d.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Manual Duration */}
          <div className="space-y-2">
            <Label>Ou saisir une durée *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="23"
                value={hours}
                onChange={(e) => {
                  setHours(e.target.value);
                  if (errors.duration) setErrors((prev) => ({ ...prev, duration: undefined }));
                }}
                placeholder="0"
                className={`w-20 text-center ${errors.duration ? 'border-destructive' : ''}`}
              />
              <span className="text-muted-foreground">h</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => {
                  setMinutes(e.target.value);
                  if (errors.duration) setErrors((prev) => ({ ...prev, duration: undefined }));
                }}
                placeholder="00"
                className={`w-20 text-center ${errors.duration ? 'border-destructive' : ''}`}
              />
              <span className="text-muted-foreground">min</span>
              <Button onClick={handleManualAdd} disabled={isLoading}>
                Ajouter
              </Button>
            </div>
            {errors.duration && (
              <p className="text-sm text-destructive">{errors.duration}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Day's Entries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Temps du jour
            </CardTitle>
            <Badge variant="secondary" className="px-3 py-1 text-lg">
              {totalHours}h{remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucune entrée pour cette journée
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: entry.project.color }}
                    />
                    <div>
                      <div className="font-medium">
                        {entry.project.name}
                        {entry.subProject && (
                          <span className="text-muted-foreground"> / {entry.subProject.name}</span>
                        )}
                      </div>
                      {entry.description && (
                        <div className="line-clamp-1 text-sm text-muted-foreground">
                          {entry.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {Math.floor(entry.duration / 60)}h
                      {entry.duration % 60 > 0 ? ` ${entry.duration % 60}min` : ''}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
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
