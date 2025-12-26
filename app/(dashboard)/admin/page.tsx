'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Users, Settings, Shield, Activity, Edit, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'VALIDATOR' | 'USER';
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  manager: { id: string; name: string } | null;
  _count: { subordinates: number; timesheets: number };
  hasLocalAuth?: boolean;
  totpEnabled?: boolean;
  authMethods?: string[];
}

interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  isActive: boolean;
}

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  members: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  _count: { members: number };
}

const roleLabels = {
  ADMIN: { label: 'Admin', variant: 'destructive' as const },
  VALIDATOR: { label: 'Manager', variant: 'default' as const },
  USER: { label: 'Employé', variant: 'secondary' as const },
};

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'USER' as 'ADMIN' | 'VALIDATOR' | 'USER',
    managerId: '',
    authMethod: 'azure' as 'azure' | 'local' | 'both',
    password: '',
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogUser, setProjectDialogUser] = useState<User | null>(null);
  const [userProjects, setUserProjects] = useState<{
    assignedProjectIds: string[];
    validatingProjectIds: string[];
  }>({ assignedProjectIds: [], validatingProjectIds: [] });

  // User groups state
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    color: '#6B7280',
    memberIds: [] as string[],
  });

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
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

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openProjectDialog = async (user: User) => {
    setProjectDialogUser(user);
    try {
      const res = await fetch(`/api/users/${user.id}/projects`);
      const data = await res.json();
      if (data.success) {
        setUserProjects({
          assignedProjectIds: data.data.assignedProjects.map((p: Project) => p.id),
          validatingProjectIds: data.data.validatingProjects.map((p: Project) => p.id),
        });
      }
    } catch (error) {
      console.error('Failed to fetch user projects:', error);
    }
    setProjectDialogOpen(true);
  };

  const handleSaveProjects = async () => {
    if (!projectDialogUser) return;

    try {
      const res = await fetch(`/api/users/${projectDialogUser.id}/projects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProjects),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'Projets assignés avec succès',
        });
        setProjectDialogOpen(false);
        setProjectDialogUser(null);
      } else {
        toast({
          title: 'Erreur',
          description: data.error || "Erreur lors de l'assignation",
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: "Erreur lors de l'assignation des projets",
        variant: 'destructive',
      });
    }
  };

  const toggleProjectAssignment = (projectId: string) => {
    setUserProjects((prev) => ({
      ...prev,
      assignedProjectIds: prev.assignedProjectIds.includes(projectId)
        ? prev.assignedProjectIds.filter((id) => id !== projectId)
        : [...prev.assignedProjectIds, projectId],
    }));
  };

  const toggleValidatorAssignment = (projectId: string) => {
    setUserProjects((prev) => ({
      ...prev,
      validatingProjectIds: prev.validatingProjectIds.includes(projectId)
        ? prev.validatingProjectIds.filter((id) => id !== projectId)
        : [...prev.validatingProjectIds, projectId],
    }));
  };

  // Group management functions
  const openGroupDialog = (group?: UserGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupFormData({
        name: group.name,
        description: group.description || '',
        color: group.color || '#6B7280',
        memberIds: group.members.map((m) => m.user.id),
      });
    } else {
      setEditingGroup(null);
      setGroupFormData({
        name: '',
        description: '',
        color: '#6B7280',
        memberIds: [],
      });
    }
    setGroupDialogOpen(true);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingGroup ? `/api/groups/${editingGroup.id}` : '/api/groups';
      const method = editingGroup ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: editingGroup ? 'Groupe modifié' : 'Groupe créé',
        });
        setGroupDialogOpen(false);
        fetchGroups();
      } else {
        toast({
          title: 'Erreur',
          description: data.error || "Erreur lors de l'enregistrement",
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

  const handleDeleteGroup = async (group: UserGroup) => {
    if (!confirm(`Supprimer le groupe "${group.name}" ?`)) return;

    try {
      const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: 'Groupe supprimé',
        });
        fetchGroups();
      } else {
        toast({
          title: 'Erreur',
          description: data.error || 'Erreur lors de la suppression',
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

  const toggleGroupMember = (userId: string) => {
    setGroupFormData((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter((id) => id !== userId)
        : [...prev.memberIds, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const payload: Record<string, unknown> = {
        name: formData.name,
        role: formData.role,
        managerId: formData.managerId || null,
      };

      if (!editingUser) {
        // Creating new user
        payload.email = formData.email;
        payload.authMethod = formData.authMethod;
        if (
          formData.password &&
          (formData.authMethod === 'local' || formData.authMethod === 'both')
        ) {
          payload.password = formData.password;
        }
      } else {
        // Updating existing user
        if (formData.password) {
          payload.password = formData.password;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: editingUser ? 'Utilisateur modifié' : 'Utilisateur créé',
        });
        setIsDialogOpen(false);
        setEditingUser(null);
        resetForm();
        fetchUsers();
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

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.manager?.id || '',
      authMethod: 'azure',
      password: '',
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Succès',
          description: `Utilisateur ${user.isActive ? 'désactivé' : 'activé'}`,
        });
        fetchUsers();
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la modification',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'USER',
      managerId: '',
      authMethod: 'azure',
      password: '',
    });
  };

  const validators = users.filter((u) => u.role === 'VALIDATOR' || u.role === 'ADMIN');

  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    admins: users.filter((u) => u.role === 'ADMIN').length,
    validators: users.filter((u) => u.role === 'VALIDATOR').length,
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <Users className="h-4 w-4" />
            Groupes
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Journal d'audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Actifs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.admins}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Validateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.validators}</div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Gestion des utilisateurs</CardTitle>
                  <CardDescription>
                    Gérez les comptes et les permissions des utilisateurs
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingUser(null);
                        resetForm();
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nouvel utilisateur
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleSubmit}>
                      <DialogHeader>
                        <DialogTitle>
                          {editingUser ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
                        </DialogTitle>
                        <DialogDescription>
                          {editingUser
                            ? "Modifiez les informations de l'utilisateur"
                            : 'Créez un nouveau compte utilisateur'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            disabled={!!editingUser}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Rôle</Label>
                          <Select
                            value={formData.role}
                            onValueChange={(v) =>
                              setFormData({ ...formData, role: v as typeof formData.role })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">Utilisateur</SelectItem>
                              <SelectItem value="VALIDATOR">Validateur</SelectItem>
                              <SelectItem value="ADMIN">Administrateur</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Manager</Label>
                          <Select
                            value={formData.managerId || 'none'}
                            onValueChange={(v) =>
                              setFormData({ ...formData, managerId: v === 'none' ? '' : v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Aucun manager" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucun</SelectItem>
                              {validators.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Auth Method - only for new users */}
                        {!editingUser && (
                          <div className="space-y-2">
                            <Label>Méthode d'authentification</Label>
                            <Select
                              value={formData.authMethod}
                              onValueChange={(v) =>
                                setFormData({
                                  ...formData,
                                  authMethod: v as typeof formData.authMethod,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="azure">Microsoft uniquement</SelectItem>
                                <SelectItem value="local">Mot de passe uniquement</SelectItem>
                                <SelectItem value="both">Les deux</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Password field */}
                        {(formData.authMethod === 'local' ||
                          formData.authMethod === 'both' ||
                          editingUser) && (
                          <div className="space-y-2">
                            <Label>
                              {editingUser
                                ? 'Nouveau mot de passe (laisser vide pour ne pas changer)'
                                : 'Mot de passe *'}
                            </Label>
                            <Input
                              type="password"
                              value={formData.password}
                              onChange={(e) =>
                                setFormData({ ...formData, password: e.target.value })
                              }
                              required={
                                !editingUser &&
                                (formData.authMethod === 'local' || formData.authMethod === 'both')
                              }
                              minLength={8}
                              placeholder="Minimum 8 caractères"
                            />
                          </div>
                        )}

                        {/* TOTP status for editing */}
                        {editingUser && editingUser.hasLocalAuth && (
                          <div className="space-y-2 rounded-md bg-muted p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>MFA (TOTP)</Label>
                                <p className="text-sm text-muted-foreground">
                                  {editingUser.totpEnabled ? 'Activé' : 'Non configuré'}
                                </p>
                              </div>
                              {editingUser.totpEnabled && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm('Réinitialiser le MFA de cet utilisateur ?')) {
                                      await fetch(`/api/users/${editingUser.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ resetTOTP: true }),
                                      });
                                      toast({
                                        title: 'MFA réinitialisé',
                                        description: "L'utilisateur devra reconfigurer son MFA",
                                      });
                                      fetchUsers();
                                    }
                                  }}
                                >
                                  Réinitialiser MFA
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button type="submit">{editingUser ? 'Modifier' : 'Créer'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-4 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tous les rôles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    <SelectItem value="ADMIN">Administrateurs</SelectItem>
                    <SelectItem value="VALIDATOR">Validateurs</SelectItem>
                    <SelectItem value="USER">Utilisateurs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Auth</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Dernière connexion</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleLabels[user.role].variant}>
                            {roleLabels[user.role].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.authMethods?.map((method) => (
                              <Badge key={method} variant="outline" className="text-xs">
                                {method === 'azure' ? 'MS' : 'Local'}
                              </Badge>
                            ))}
                            {user.hasLocalAuth && (
                              <Badge
                                variant={user.totpEnabled ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                <Shield className="mr-1 h-3 w-3" />
                                {user.totpEnabled ? 'MFA' : 'No MFA'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.manager?.name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? 'success' : 'secondary'}>
                            {user.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.lastLoginAt
                            ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openProjectDialog(user)}
                              title="Gérer les projets"
                            >
                              <FolderKanban className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(user)}
                            >
                              {user.isActive ? 'Désactiver' : 'Activer'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Gestion des groupes</CardTitle>
                  <CardDescription>Créez et gérez des groupes d'utilisateurs</CardDescription>
                </div>
                <Button onClick={() => openGroupDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau groupe
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">Aucun groupe</h3>
                  <p className="text-muted-foreground">Créez votre premier groupe d'utilisateurs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Membres</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: group.color || '#6B7280' }}
                            />
                            <span className="font-medium">{group.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {group.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {group._count.members} membre{group._count.members !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={group.isActive ? 'success' : 'secondary'}>
                            {group.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openGroupDialog(group)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteGroup(group)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres système</CardTitle>
              <CardDescription>Configuration générale de l'application</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Les paramètres système seront disponibles prochainement.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Journal d'audit</CardTitle>
              <CardDescription>Historique de toutes les actions effectuées</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Le journal d'audit sera disponible prochainement.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleGroupSubmit}>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Modifier le groupe' : 'Nouveau groupe'}</DialogTitle>
              <DialogDescription>
                {editingGroup
                  ? 'Modifiez les informations du groupe'
                  : "Créez un nouveau groupe d'utilisateurs"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom du groupe *</Label>
                  <Input
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    required
                    placeholder="Ex: Équipe Marketing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Couleur</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={groupFormData.color}
                      onChange={(e) =>
                        setGroupFormData({ ...groupFormData, color: e.target.value })
                      }
                      className="h-10 w-14 cursor-pointer p-1"
                    />
                    <Input
                      value={groupFormData.color}
                      onChange={(e) =>
                        setGroupFormData({ ...groupFormData, color: e.target.value })
                      }
                      placeholder="#6B7280"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={groupFormData.description}
                  onChange={(e) =>
                    setGroupFormData({ ...groupFormData, description: e.target.value })
                  }
                  placeholder="Description du groupe (optionnel)"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Membres ({groupFormData.memberIds.length} sélectionné
                  {groupFormData.memberIds.length !== 1 ? 's' : ''})
                </Label>
                <ScrollArea className="h-[200px] rounded-md border p-4">
                  <div className="space-y-3">
                    {users
                      .filter((u) => u.isActive)
                      .map((user) => (
                        <div key={user.id} className="flex items-center gap-3">
                          <Checkbox
                            id={`group-member-${user.id}`}
                            checked={groupFormData.memberIds.includes(user.id)}
                            onCheckedChange={() => toggleGroupMember(user.id)}
                          />
                          <label
                            htmlFor={`group-member-${user.id}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            <span className="font-medium">{user.name}</span>
                            <span className="ml-2 text-muted-foreground">({user.email})</span>
                          </label>
                          <Badge variant={roleLabels[user.role].variant} className="text-xs">
                            {roleLabels[user.role].label}
                          </Badge>
                        </div>
                      ))}
                    {users.filter((u) => u.isActive).length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucun utilisateur actif</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editingGroup ? 'Modifier' : 'Créer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Project Assignment Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestion des projets</DialogTitle>
            <DialogDescription>
              {projectDialogUser && (
                <>
                  Assignez des projets à <strong>{projectDialogUser.name}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Assigned Projects */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Projets assignés</Label>
              <p className="text-sm text-muted-foreground">
                Projets sur lesquels l'utilisateur peut saisir du temps
              </p>
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-3">
                  {projects
                    .filter((p) => p.isActive)
                    .map((project) => (
                      <div key={project.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`assign-${project.id}`}
                          checked={userProjects.assignedProjectIds.includes(project.id)}
                          onCheckedChange={() => toggleProjectAssignment(project.id)}
                        />
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: project.color || '#3B82F6' }}
                        />
                        <label
                          htmlFor={`assign-${project.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          {project.name}
                          <span className="ml-2 text-muted-foreground">({project.code})</span>
                        </label>
                      </div>
                    ))}
                  {projects.filter((p) => p.isActive).length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun projet actif</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Validator Projects - Only show for validators and admins */}
            {projectDialogUser &&
              (projectDialogUser.role === 'VALIDATOR' || projectDialogUser.role === 'ADMIN') && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Projets à valider</Label>
                  <p className="text-sm text-muted-foreground">
                    Projets dont l'utilisateur peut valider les feuilles de temps
                  </p>
                  <ScrollArea className="h-[200px] rounded-md border p-4">
                    <div className="space-y-3">
                      {projects
                        .filter((p) => p.isActive)
                        .map((project) => (
                          <div key={project.id} className="flex items-center gap-3">
                            <Checkbox
                              id={`validate-${project.id}`}
                              checked={userProjects.validatingProjectIds.includes(project.id)}
                              onCheckedChange={() => toggleValidatorAssignment(project.id)}
                            />
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: project.color || '#3B82F6' }}
                            />
                            <label
                              htmlFor={`validate-${project.id}`}
                              className="flex-1 cursor-pointer text-sm"
                            >
                              {project.name}
                              <span className="ml-2 text-muted-foreground">({project.code})</span>
                            </label>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveProjects}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
