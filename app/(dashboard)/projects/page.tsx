'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  FolderKanban,
  Plus,
  Search,
  DollarSign,
  Clock,
  Users,
  Edit,
  Trash2,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  hourlyRate: number | null;
  budgetHours: number | null;
  isActive: boolean;
  isBillable: boolean;
  color: string;
  spentHours: number;
  subProjects: Array<{ id: string; name: string; code: string | null }>;
  validators: Array<{ user: { id: string; name: string; email: string } }>;
  _count: { timeEntries: number };
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    hourlyRate: '',
    budgetHours: '',
    isBillable: true,
    color: '#3B82F6',
  });

  const isAdmin = session?.user?.role === 'ADMIN';

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      description: formData.description || undefined,
      hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined,
      budgetHours: formData.budgetHours ? parseFloat(formData.budgetHours) : undefined,
      isBillable: formData.isBillable,
      color: formData.color,
    };

    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects';
      const method = editingProject ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: editingProject ? 'Projet modifié' : 'Projet créé',
        });
        setIsDialogOpen(false);
        setEditingProject(null);
        resetForm();
        fetchProjects();
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
        description: 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      code: project.code,
      description: project.description || '',
      hourlyRate: project.hourlyRate?.toString() || '',
      budgetHours: project.budgetHours?.toString() || '',
      isBillable: project.isBillable,
      color: project.color,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      hourlyRate: '',
      budgetHours: '',
      isBillable: true,
      color: '#3B82F6',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingProject(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau projet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingProject ? 'Modifier le projet' : 'Nouveau projet'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProject
                      ? 'Modifiez les informations du projet'
                      : 'Créez un nouveau projet pour le suivi du temps'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code *</Label>
                      <Input
                        value={formData.code}
                        onChange={(e) =>
                          setFormData({ ...formData, code: e.target.value.toUpperCase() })
                        }
                        placeholder="EX: PROJ-001"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Taux horaire</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.hourlyRate}
                        onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                        placeholder="150.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Budget heures</Label>
                      <Input
                        type="number"
                        value={formData.budgetHours}
                        onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <Input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="h-10 p-1"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        checked={formData.isBillable}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isBillable: checked })
                        }
                      />
                      <Label>Facturable</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {editingProject ? 'Modifier' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Aucun projet trouvé</h3>
            <p className="text-muted-foreground">
              {search ? 'Essayez une autre recherche' : 'Créez votre premier projet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const budgetProgress = project.budgetHours
              ? (project.spentHours / Number(project.budgetHours)) * 100
              : 0;

            return (
              <Card key={project.id} className="overflow-hidden">
                <div className="h-2" style={{ backgroundColor: project.color }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription className="font-mono">{project.code}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {!project.isActive && (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                      {project.isBillable && (
                        <Badge variant="outline" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          Facturable
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Heures utilisées
                      </span>
                      <span className="font-medium">
                        {project.spentHours.toFixed(1)}h
                        {project.budgetHours && ` / ${Number(project.budgetHours)}h`}
                      </span>
                    </div>
                    {project.budgetHours && (
                      <Progress
                        value={Math.min(budgetProgress, 100)}
                        className={budgetProgress > 90 ? 'bg-destructive/20' : ''}
                      />
                    )}
                  </div>

                  {project.hourlyRate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Taux horaire</span>
                      <span className="font-medium">{Number(project.hourlyRate).toFixed(2)} EUR</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Sous-projets
                    </span>
                    <span>{project.subProjects.length}</span>
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(project)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
