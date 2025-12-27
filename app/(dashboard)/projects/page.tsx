'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Settings,
  Layers,
  UsersRound,
} from 'lucide-react';

interface SubProject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  spentHours?: number;
  _count?: { timeEntries: number };
}

interface Group {
  id: string;
  name: string;
  color: string | null;
  members?: Array<{ user: { id: string; name: string; email: string } }>;
}

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
  subProjects: SubProject[];
  validators: Array<{ user: { id: string; name: string; email: string } }>;
  groups: Array<{ group: Group }>;
  _count: { timeEntries: number };
}

function ProjectsContent() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Project detail sheet
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [projectSubProjects, setProjectSubProjects] = useState<SubProject[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Sub-project form
  const [isSubProjectDialogOpen, setIsSubProjectDialogOpen] = useState(false);
  const [editingSubProject, setEditingSubProject] = useState<SubProject | null>(null);
  const [subProjectFormData, setSubProjectFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

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

  // Validation state
  const [formErrors, setFormErrors] = useState<{ name?: string; code?: string }>({});

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
    fetchAllGroups();
  }, []);

  const fetchAllGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (data.success) {
        setAllGroups(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchProjectSubProjects = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/subprojects`);
      const data = await res.json();
      if (data.success) {
        setProjectSubProjects(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch sub-projects:', error);
    }
  };

  const fetchProjectGroups = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/groups`);
      const data = await res.json();
      if (data.success) {
        setSelectedGroupIds(data.data.map((g: Group) => g.id));
      }
    } catch (error) {
      console.error('Failed to fetch project groups:', error);
    }
  };

  const openProjectSheet = async (project: Project) => {
    setSelectedProject(project);
    setIsSheetOpen(true);
    await Promise.all([fetchProjectSubProjects(project.id), fetchProjectGroups(project.id)]);
  };

  const handleSaveGroups = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: selectedGroupIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Succès', description: 'Groupes mis à jour' });
        fetchProjects();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la sauvegarde',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSubProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const url = editingSubProject
        ? `/api/projects/${selectedProject.id}/subprojects/${editingSubProject.id}`
        : `/api/projects/${selectedProject.id}/subprojects`;
      const method = editingSubProject ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subProjectFormData),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Succès',
          description: editingSubProject ? 'Sous-projet modifié' : 'Sous-projet créé',
        });
        setIsSubProjectDialogOpen(false);
        setEditingSubProject(null);
        setSubProjectFormData({ name: '', code: '', description: '' });
        fetchProjectSubProjects(selectedProject.id);
        fetchProjects();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la sauvegarde',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSubProject = async (subProjectId: string) => {
    if (!selectedProject) return;
    if (!confirm('Supprimer ce sous-projet ?')) return;

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/subprojects/${subProjectId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Succès', description: data.data.message });
        fetchProjectSubProjects(selectedProject.id);
        fetchProjects();
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  const openEditSubProject = (sp: SubProject) => {
    setEditingSubProject(sp);
    setSubProjectFormData({
      name: sp.name,
      code: sp.code || '',
      description: sp.description || '',
    });
    setIsSubProjectDialogOpen(true);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const errors: { name?: string; code?: string } = {};
    if (!formData.name.trim()) {
      errors.name = 'Le nom est obligatoire';
    }
    if (!formData.code.trim()) {
      errors.code = 'Le code est obligatoire';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

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
        // Format detailed error messages if available
        let errorMsg = data.error || 'Erreur inconnue';
        if (data.errors) {
          const fieldErrors = Object.entries(data.errors)
            .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
            .join('\n');
          errorMsg = fieldErrors || errorMsg;
        }
        toast({
          title: 'Erreur',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: "Erreur lors de l'enregistrement",
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
    setFormErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
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
              <Button
                onClick={() => {
                  setEditingProject(null);
                  resetForm();
                }}
              >
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
                        onChange={(e) => {
                          setFormData({ ...formData, name: e.target.value });
                          if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        className={formErrors.name ? 'border-destructive' : ''}
                      />
                      {formErrors.name && (
                        <p className="text-sm text-destructive">{formErrors.name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Code *</Label>
                      <Input
                        value={formData.code}
                        onChange={(e) => {
                          setFormData({ ...formData, code: e.target.value.toUpperCase() });
                          if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: undefined }));
                        }}
                        placeholder="EX: PROJ-001"
                        className={formErrors.code ? 'border-destructive' : ''}
                      />
                      {formErrors.code && (
                        <p className="text-sm text-destructive">{formErrors.code}</p>
                      )}
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
                  <Button type="submit">{editingProject ? 'Modifier' : 'Créer'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
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
                      {!project.isActive && <Badge variant="secondary">Inactif</Badge>}
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
                    <p className="line-clamp-2 text-sm text-muted-foreground">
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
                      <span className="font-medium">
                        {Number(project.hourlyRate).toFixed(2)} EUR
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      Sous-projets
                    </span>
                    <span>{project.subProjects.length}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <UsersRound className="h-4 w-4" />
                      Groupes
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {project.groups.length > 0 ? (
                        project.groups.slice(0, 2).map(({ group }) => (
                          <Badge
                            key={group.id}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: group.color || undefined }}
                          >
                            {group.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Aucun</span>
                      )}
                      {project.groups.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{project.groups.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end gap-2 border-t pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openProjectSheet(project)}
                        title="Gérer sous-projets et groupes"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
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

      {/* Project Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: selectedProject?.color }}
              />
              {selectedProject?.name}
            </SheetTitle>
            <SheetDescription>{selectedProject?.code}</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="subprojects" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="subprojects" className="gap-2">
                <Layers className="h-4 w-4" />
                Sous-projets
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <UsersRound className="h-4 w-4" />
                Groupes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="subprojects" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Gérez les sous-projets de ce projet</p>
                <Dialog open={isSubProjectDialogOpen} onOpenChange={setIsSubProjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingSubProject(null);
                        setSubProjectFormData({ name: '', code: '', description: '' });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleCreateSubProject}>
                      <DialogHeader>
                        <DialogTitle>
                          {editingSubProject ? 'Modifier le sous-projet' : 'Nouveau sous-projet'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input
                            value={subProjectFormData.name}
                            onChange={(e) =>
                              setSubProjectFormData({ ...subProjectFormData, name: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Code</Label>
                          <Input
                            value={subProjectFormData.code}
                            onChange={(e) =>
                              setSubProjectFormData({ ...subProjectFormData, code: e.target.value })
                            }
                            placeholder="Optionnel"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={subProjectFormData.description}
                            onChange={(e) =>
                              setSubProjectFormData({
                                ...subProjectFormData,
                                description: e.target.value,
                              })
                            }
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit">{editingSubProject ? 'Modifier' : 'Créer'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <ScrollArea className="h-[400px]">
                {projectSubProjects.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">Aucun sous-projet</div>
                ) : (
                  <div className="space-y-2">
                    {projectSubProjects.map((sp) => (
                      <div
                        key={sp.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {sp.name}
                            {!sp.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Inactif
                              </Badge>
                            )}
                          </div>
                          {sp.code && (
                            <div className="font-mono text-sm text-muted-foreground">{sp.code}</div>
                          )}
                          {sp.spentHours !== undefined && (
                            <div className="text-sm text-muted-foreground">
                              {sp.spentHours.toFixed(1)}h utilisées
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditSubProject(sp)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSubProject(sp.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="groups" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Sélectionnez les groupes qui peuvent utiliser ce projet
              </p>

              <ScrollArea className="h-[350px]">
                {allGroups.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Aucun groupe disponible
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center space-x-3 rounded-lg border p-3"
                      >
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedGroupIds([...selectedGroupIds, group.id]);
                            } else {
                              setSelectedGroupIds(selectedGroupIds.filter((id) => id !== group.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`group-${group.id}`}
                            className="flex cursor-pointer items-center gap-2 font-medium"
                          >
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: group.color || '#6B7280' }}
                            />
                            {group.name}
                          </label>
                          {group.members && group.members.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {group.members.length} membre
                              {group.members.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSaveGroups}>Enregistrer les groupes</Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
