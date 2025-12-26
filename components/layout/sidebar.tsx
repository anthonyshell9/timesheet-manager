'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Clock,
  FileText,
  Calendar,
  FolderKanban,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Saisie du temps', href: '/time-entry', icon: Clock },
  { name: 'Mes feuilles', href: '/timesheets', icon: FileText },
  { name: 'Calendrier', href: '/calendar', icon: Calendar },
  { name: 'Projets', href: '/projects', icon: FolderKanban },
  { name: 'À valider', href: '/validations', icon: CheckSquare, roles: ['ADMIN', 'VALIDATOR'] },
  { name: 'Rapports', href: '/reports', icon: BarChart3 },
  { name: 'Administration', href: '/admin', icon: Settings, roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState<{ validations: number; drafts: number }>({
    validations: 0,
    drafts: 0,
  });

  const userRole = session?.user?.role;

  // Fetch badge counts
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        // Fetch pending validations for managers/admins
        if (userRole === 'VALIDATOR' || userRole === 'ADMIN') {
          const validationsRes = await fetch('/api/approvals?status=PENDING');
          const validationsData = await validationsRes.json();
          if (validationsData.success) {
            setBadges((prev) => ({ ...prev, validations: validationsData.data.length }));
          }
        }

        // Fetch draft timesheets for all users
        const timesheetsRes = await fetch('/api/timesheets?status=DRAFT');
        const timesheetsData = await timesheetsRes.json();
        if (timesheetsData.success) {
          setBadges((prev) => ({ ...prev, drafts: timesheetsData.data.length }));
        }
      } catch (error) {
        console.error('Failed to fetch badges:', error);
      }
    };

    if (session?.user) {
      fetchBadges();
      // Refresh every 60 seconds
      const interval = setInterval(fetchBadges, 60000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [session?.user, userRole]);

  const filteredNavigation = navigation.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">TimeSheet</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(collapsed && 'mx-auto')}
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            // Determine badge count for this item
            let badgeCount = 0;
            if (item.href === '/validations') badgeCount = badges.validations;
            if (item.href === '/timesheets') badgeCount = badges.drafts;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{item.name}</span>
                )}
                {!collapsed && badgeCount > 0 && (
                  <Badge
                    variant={isActive ? 'secondary' : 'destructive'}
                    className="h-5 min-w-5 justify-center px-1.5 text-xs"
                  >
                    {badgeCount}
                  </Badge>
                )}
                {collapsed && badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn('mb-2 w-full', collapsed && 'px-2')}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          {!collapsed && (
            <span className="ml-2">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-2',
                collapsed && 'justify-center px-2'
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || undefined} />
                <AvatarFallback>
                  {session?.user?.name ? getInitials(session.user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {session?.user?.name || 'Utilisateur'}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {userRole === 'ADMIN'
                      ? 'Admin'
                      : userRole === 'VALIDATOR'
                        ? 'Manager'
                        : 'Employé'}
                  </Badge>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
