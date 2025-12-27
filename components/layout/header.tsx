'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/time-entry': 'Saisie du temps',
  '/timesheets': 'Mes feuilles de temps',
  '/calendar': 'Calendrier',
  '/projects': 'Projets',
  '/validations': 'Validations',
  '/reports': 'Rapports',
  '/admin': 'Administration',
};

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function Header() {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const pageTitle =
    Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] ||
    'TimeSheet Manager';

  useEffect(() => {
    // Fetch notifications
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications?limit=5');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.data || []);
          setUnreadCount(data.data?.filter((n: Notification) => !n.isRead).length || 0);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Rechercher..." className="w-64 pl-9" />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              {unreadCount > 0 && <Badge variant="secondary">{unreadCount} non lue(s)</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Aucune notification
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                  className={notification.isRead ? 'opacity-60' : ''}
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{notification.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary">
              Voir toutes les notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
