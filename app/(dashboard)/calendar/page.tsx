'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TimeEntry {
  id: string;
  date: string;
  duration: number;
  project: { id: string; name: string; code: string; color: string };
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/time-entries?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`
        );
        const data = await res.json();
        if (data.success) {
          setEntries(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch entries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntries();
  }, [currentMonth]);

  const entriesByDate = useMemo(() => {
    const grouped: Record<string, TimeEntry[]> = {};
    entries.forEach((entry) => {
      const dateKey = entry.date.split('T')[0]!;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(entry);
    });
    return grouped;
  }, [entries]);

  const getTotalForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayEntries = entriesByDate[dateKey] || [];
    return dayEntries.reduce((acc, e) => acc + e.duration, 0) / 60;
  };

  const selectedDayEntries = selectedDate
    ? entriesByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : [];

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </CardTitle>
                <CardDescription>Cliquez sur un jour pour voir les détails</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
                  Aujourd'hui
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const total = getTotalForDate(day);
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEntries = entriesByDate[dateKey] || [];
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'aspect-square p-1 rounded-lg border text-left transition-colors',
                      'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring',
                      !isSameMonth(day, currentMonth) && 'opacity-40',
                      isToday(day) && 'border-primary',
                      isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                  >
                    <div className="flex flex-col h-full">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isToday(day) && !isSelected && 'text-primary'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {total > 0 && (
                        <div className="mt-auto">
                          <Badge
                            variant={isSelected ? 'secondary' : 'outline'}
                            className="text-xs w-full justify-center"
                          >
                            {total.toFixed(1)}h
                          </Badge>
                        </div>
                      )}
                      {/* Project dots */}
                      {dayEntries.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap">
                          {[...new Set(dayEntries.map((e) => e.project.color))]
                            .slice(0, 4)
                            .map((color, i) => (
                              <div
                                key={i}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {selectedDate
                ? format(selectedDate, 'EEEE d MMMM', { locale: fr })
                : 'Sélectionnez un jour'}
            </CardTitle>
            {selectedDate && (
              <CardDescription>
                Total: {getTotalForDate(selectedDate).toFixed(1)} heures
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-center text-muted-foreground py-8">
                Cliquez sur un jour du calendrier pour voir les entrées
              </p>
            ) : selectedDayEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune entrée pour ce jour
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDayEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.project.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.project.name}</p>
                      <p className="text-sm text-muted-foreground">{entry.project.code}</p>
                    </div>
                    <Badge variant="outline">{(entry.duration / 60).toFixed(1)}h</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
