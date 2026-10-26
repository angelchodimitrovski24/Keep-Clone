'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  CheckSquare,
  Bell,
  Clock,
  MapPin,
  Menu,
  X,
  Filter,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import {
  CalendarItem,
  CalendarEvent,
  CalendarTask,
  CalendarViewMode,
} from '@/types/calendar';
import { CalendarItemModal } from './CalendarItemModal';
import { Note } from '@/types/note';

// Helper date utilities
function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function getStartOfWeek(d: Date, startOnSunday = true): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (startOnSunday ? 0 : day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function toDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const CalendarView: React.FC = () => {
  const {
    calendarItems,
    addCalendarItem,
    updateCalendarItem,
    deleteCalendarItem,
    toggleTaskComplete,
    notes,
    setEditingNote,
  } = useKeep();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  // Filters
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showReminders, setShowReminders] = useState(true);
  const [showMiniSidebar, setShowMiniSidebar] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CalendarItem | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>();
  const [modalInitialHour, setModalInitialHour] = useState<number | undefined>();

  // Day "+X more" Popover
  const [dayPopoverDate, setDayPopoverDate] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  // Filter note reminders
  const noteReminders = useMemo(() => {
    return notes
      .filter((n) => !n.isTrash && !n.isArchived && n.reminder)
      .map((n) => {
        const remDate = new Date(n.reminder!);
        return {
          id: `note-${n.id}`,
          noteId: n.id,
          title: n.title || 'Untitled Note',
          dateStr: toDateString(remDate),
          timeStr: remDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: n,
        };
      });
  }, [notes]);

  // Navigate functions
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const copy = new Date(prev);
      if (viewMode === 'month') {
        copy.setMonth(copy.getMonth() - 1);
      } else if (viewMode === 'week') {
        copy.setDate(copy.getDate() - 7);
      } else {
        copy.setDate(copy.getDate() - 1);
      }
      return copy;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const copy = new Date(prev);
      if (viewMode === 'month') {
        copy.setMonth(copy.getMonth() + 1);
      } else if (viewMode === 'week') {
        copy.setDate(copy.getDate() + 7);
      } else {
        copy.setDate(copy.getDate() + 1);
      }
      return copy;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openCreateModal = (dateStr?: string, hour?: number) => {
    setItemToEdit(null);
    setModalInitialDate(dateStr || toDateString(currentDate));
    setModalInitialHour(hour);
    setIsModalOpen(true);
  };

  const openEditModal = (item: CalendarItem) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  // Month grid computation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun

    // 42 cells (6 rows x 7 cols)
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        isCurrentMonth: d.getMonth() === month,
        isToday: isSameDay(d, today),
      });
    }

    return days;
  }, [currentDate, today]);

  // Week days computation
  const weekDays = useMemo(() => {
    const start = getStartOfWeek(currentDate);
    const days: { date: Date; dateStr: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        isToday: isSameDay(d, today),
      });
    }
    return days;
  }, [currentDate, today]);

  // Items by date lookup map
  const itemsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        events: CalendarEvent[];
        tasks: CalendarTask[];
        reminders: typeof noteReminders;
      }
    >();

    const getEntry = (dStr: string) => {
      if (!map.has(dStr)) {
        map.set(dStr, { events: [], tasks: [], reminders: [] });
      }
      return map.get(dStr)!;
    };

    if (showEvents) {
      calendarItems.forEach((item) => {
        if (item.type === 'event') {
          getEntry(item.startDate).events.push(item as CalendarEvent);
        }
      });
    }

    if (showTasks) {
      calendarItems.forEach((item) => {
        if (item.type === 'task') {
          getEntry(item.dueDate).tasks.push(item as CalendarTask);
        }
      });
    }

    if (showReminders) {
      noteReminders.forEach((nr) => {
        getEntry(nr.dateStr).reminders.push(nr);
      });
    }

    return map;
  }, [calendarItems, noteReminders, showEvents, showTasks, showReminders]);

  // Mini calendar month computation for sidebar
  const miniCalendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();

    const start = new Date(firstDay);
    start.setDate(start.getDate() - startDay);

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isSelected: boolean }[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        isCurrentMonth: d.getMonth() === month,
        isSelected: isSameDay(d, currentDate),
      });
    }
    return days;
  }, [currentDate]);

  // Schedule items sorted chronologically
  const scheduleGroups = useMemo(() => {
    const dateSet = new Set<string>();

    calendarItems.forEach((item) => {
      if (item.type === 'event' && showEvents) dateSet.add(item.startDate);
      if (item.type === 'task' && showTasks) dateSet.add(item.dueDate);
    });

    if (showReminders) {
      noteReminders.forEach((nr) => dateSet.add(nr.dateStr));
    }

    const sortedDates = Array.from(dateSet).sort();

    return sortedDates.map((dStr) => {
      const [y, m, d] = dStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const entry = itemsByDate.get(dStr) || { events: [], tasks: [], reminders: [] };
      return {
        dateStr: dStr,
        dateObj,
        isToday: isSameDay(dateObj, today),
        events: entry.events,
        tasks: entry.tasks,
        reminders: entry.reminders,
      };
    });
  }, [calendarItems, noteReminders, itemsByDate, showEvents, showTasks, showReminders, today]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-white dark:bg-[#1f2023] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden select-none">
      {/* 1. Google Calendar Top Navigation Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#202124]">
        {/* Left: Brand, Today, Nav Arrows, Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowMiniSidebar(!showMiniSidebar)}
            className="p-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full lg:hidden"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {today.getDate()}
            </div>
            <span className="font-semibold text-lg hidden sm:inline text-stone-800 dark:text-stone-100 tracking-tight">
              Calendar
            </span>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="ml-2 px-3.5 py-1.5 text-xs font-semibold rounded-full border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 transition-colors"
          >
            Today
          </button>

          <div className="flex items-center">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              title="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100 ml-1">
            {formatMonthYear(currentDate)}
          </h2>
        </div>

        {/* Right: View switcher & Create Button */}
        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex bg-stone-100 dark:bg-stone-800/80 p-0.5 rounded-xl border border-stone-200 dark:border-stone-700/60 text-xs font-medium">
            {(['month', 'week', 'day', 'schedule'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Quick Create Button */}
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content: Sidebar + Calendar Grid */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar Panel (Mini Calendar & Calendar Layer Checkboxes) */}
        <aside
          className={`absolute lg:static top-0 bottom-0 left-0 z-20 w-64 bg-white dark:bg-[#202124] border-r border-stone-200 dark:border-stone-800 p-4 overflow-y-auto transition-transform duration-200 shadow-xl lg:shadow-none ${
            showMiniSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Close for mobile */}
          <div className="flex items-center justify-between pb-2 lg:hidden">
            <span className="text-sm font-semibold">Calendar filters</span>
            <button
              type="button"
              onClick={() => setShowMiniSidebar(false)}
              className="p-1 rounded-full text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Create Floating Button in sidebar for desktop */}
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="w-full mb-5 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 shadow-md font-semibold text-sm transition-all hover:shadow-lg active:scale-98"
          >
            <Plus className="w-5 h-5 text-blue-600" />
            Create Event or Task
          </button>

          {/* Mini Calendar Month Picker */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                {formatMonthYear(currentDate)}
              </span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-stone-400 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {miniCalendarDays.map((d, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentDate(d.date);
                    if (window.innerWidth < 1024) setShowMiniSidebar(false);
                  }}
                  className={`w-6 h-6 mx-auto rounded-full text-[11px] flex items-center justify-center transition-colors ${
                    isSameDay(d.date, today)
                      ? 'bg-blue-600 text-white font-bold'
                      : d.isSelected
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold'
                      : d.isCurrentMonth
                      ? 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                      : 'text-stone-300 dark:text-stone-600'
                  }`}
                >
                  {d.date.getDate()}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Layers Checklists (Google Calendar signature sidebar) */}
          <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-1">
              Calendars & Layers
            </h4>

            {/* Events */}
            <label className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-200">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={(e) => setShowEvents(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500 cursor-pointer"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
              <span>Events</span>
            </label>

            {/* Tasks */}
            <label className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-200">
              <input
                type="checkbox"
                checked={showTasks}
                onChange={(e) => setShowTasks(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
              <span>Tasks</span>
            </label>

            {/* Note Reminders */}
            <label className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer text-xs font-medium text-stone-700 dark:text-stone-200">
              <input
                type="checkbox"
                checked={showReminders}
                onChange={(e) => setShowReminders(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded-sm focus:ring-amber-500 cursor-pointer"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Note Reminders</span>
            </label>
          </div>
        </aside>

        {/* Backdrop for mobile mini-sidebar */}
        {showMiniSidebar && (
          <div
            onClick={() => setShowMiniSidebar(false)}
            className="fixed inset-0 bg-black/40 z-10 lg:hidden"
          />
        )}

        {/* Calendar Main Grid Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-stone-50 dark:bg-[#18191a]">
          {/* ======================= 1. MONTH VIEW ======================= */}
          {viewMode === 'month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Day headers Sun - Sat */}
              <div className="grid grid-cols-7 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#202124] text-center text-xs font-semibold text-stone-500 py-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* 6-row month grid */}
              <div className="flex-1 grid grid-cols-7 grid-rows-6 border-b border-stone-200 dark:border-stone-800 overflow-y-auto">
                {monthDays.map((dayObj, idx) => {
                  const entry = itemsByDate.get(dayObj.dateStr);
                  const events = entry?.events || [];
                  const tasks = entry?.tasks || [];
                  const reminders = entry?.reminders || [];
                  const totalItems = events.length + tasks.length + reminders.length;

                  return (
                    <div
                      key={idx}
                      onClick={() => openCreateModal(dayObj.dateStr)}
                      className={`min-h-[85px] border-r border-b border-stone-200 dark:border-stone-800/80 p-1 sm:p-1.5 flex flex-col transition-colors cursor-pointer group hover:bg-blue-50/40 dark:hover:bg-blue-950/20 ${
                        !dayObj.isCurrentMonth ? 'bg-stone-100/50 dark:bg-stone-900/30 opacity-60' : ''
                      }`}
                    >
                      {/* Day number header */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                            dayObj.isToday
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          {dayObj.date.getDate()}
                        </span>
                        {/* Quick plus on hover */}
                        <span className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-blue-600 transition-opacity p-0.5">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      {/* Items List (max 3 displayed chips) */}
                      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                        {/* Events */}
                        {events.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(ev);
                            }}
                            className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm truncate flex items-center gap-1 shadow-2xs hover:brightness-95 transition-all text-white"
                            style={{ backgroundColor: ev.color || '#039be5' }}
                            title={`${ev.startTime || ''} ${ev.title}`}
                          >
                            {ev.startTime && <span className="opacity-80 text-[10px]">{ev.startTime}</span>}
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}

                        {/* Tasks */}
                        {tasks.slice(0, 2).map((tsk) => (
                          <div
                            key={tsk.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(tsk);
                            }}
                            className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm truncate flex items-center gap-1 bg-white dark:bg-stone-800 border border-emerald-500/40 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-750 transition-all shadow-2xs"
                            title={tsk.title}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskComplete(tsk.id);
                              }}
                              className="shrink-0 text-emerald-600 dark:text-emerald-400"
                            >
                              <CheckSquare
                                className={`w-3.5 h-3.5 ${tsk.isCompleted ? 'opacity-100' : 'opacity-60'}`}
                              />
                            </button>
                            <span
                              className={`truncate ${
                                tsk.isCompleted ? 'line-through opacity-50' : ''
                              }`}
                            >
                              {tsk.title}
                            </span>
                          </div>
                        ))}

                        {/* Note Reminders */}
                        {reminders.slice(0, 1).map((nr) => (
                          <div
                            key={nr.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNote(nr.note);
                            }}
                            className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm truncate flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-400/40 text-amber-800 dark:text-amber-200 hover:brightness-95 transition-all shadow-2xs"
                            title={`Note: ${nr.title}`}
                          >
                            <Bell className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{nr.title}</span>
                          </div>
                        ))}

                        {/* More items indicator */}
                        {totalItems > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDayPopoverDate(dayObj.dateStr);
                            }}
                            className="text-[10px] font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-left px-1 mt-auto"
                          >
                            +{totalItems - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================= 2. WEEK VIEW ======================= */}
          {viewMode === 'week' && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Header row with 7 weekdays */}
              <div className="grid grid-cols-8 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#202124] text-xs font-semibold py-2">
                <div className="text-center text-stone-400 border-r border-stone-200 dark:border-stone-800">
                  Time
                </div>
                {weekDays.map((w, idx) => (
                  <div
                    key={idx}
                    className={`text-center flex flex-col items-center justify-center border-r border-stone-200 dark:border-stone-800 last:border-r-0 ${
                      w.isToday ? 'text-blue-600 dark:text-blue-400' : 'text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-wider opacity-75">
                      {w.date.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        w.isToday ? 'bg-blue-600 text-white' : ''
                      }`}
                    >
                      {w.date.getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 24-hour time slots */}
              <div className="flex-1 divide-y divide-stone-200 dark:divide-stone-800">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const hourLabel =
                    hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;

                  return (
                    <div key={hour} className="grid grid-cols-8 min-h-[50px]">
                      {/* Hour column */}
                      <div className="text-right pr-2 text-[11px] text-stone-400 font-medium -mt-2.5 border-r border-stone-200 dark:border-stone-800">
                        {hourLabel}
                      </div>

                      {/* 7 day cells for this hour */}
                      {weekDays.map((w, dayIdx) => {
                        const entry = itemsByDate.get(w.dateStr);
                        const hourEvents = (entry?.events || []).filter((ev) => {
                          if (ev.isAllDay) return hour === 9;
                          const evHour = ev.startTime ? parseInt(ev.startTime.split(':')[0], 10) : 9;
                          return evHour === hour;
                        });
                        const hourTasks = (entry?.tasks || []).filter((tsk) => {
                          const tskHour = tsk.dueTime ? parseInt(tsk.dueTime.split(':')[0], 10) : 12;
                          return tskHour === hour;
                        });

                        return (
                          <div
                            key={dayIdx}
                            onClick={() => openCreateModal(w.dateStr, hour)}
                            className="border-r border-stone-200 dark:border-stone-800 last:border-r-0 p-1 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer flex flex-col gap-1 transition-colors relative"
                          >
                            {hourEvents.map((ev) => (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(ev);
                                }}
                                className="text-[11px] text-white font-medium p-1 rounded-md shadow-xs truncate"
                                style={{ backgroundColor: ev.color || '#039be5' }}
                              >
                                {ev.title}
                              </div>
                            ))}
                            {hourTasks.map((tsk) => (
                              <div
                                key={tsk.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(tsk);
                                }}
                                className="text-[11px] border border-emerald-500/50 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-medium p-1 rounded-md shadow-xs truncate flex items-center gap-1"
                              >
                                <CheckSquare className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className={tsk.isCompleted ? 'line-through opacity-50' : ''}>
                                  {tsk.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================= 3. DAY VIEW ======================= */}
          {viewMode === 'day' && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Day title bar */}
              <div className="px-6 py-3 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#202124] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {formatDayHeader(currentDate)}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {isSameDay(currentDate, today) ? 'Today' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCreateModal(toDateString(currentDate))}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs"
                >
                  + Add to Day
                </button>
              </div>

              {/* 24-hour day schedule list */}
              <div className="flex-1 divide-y divide-stone-200 dark:divide-stone-800">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const hourLabel =
                    hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
                  const dateStr = toDateString(currentDate);
                  const entry = itemsByDate.get(dateStr);
                  const hourEvents = (entry?.events || []).filter((ev) => {
                    if (ev.isAllDay) return hour === 9;
                    const evHour = ev.startTime ? parseInt(ev.startTime.split(':')[0], 10) : 9;
                    return evHour === hour;
                  });
                  const hourTasks = (entry?.tasks || []).filter((tsk) => {
                    const tskHour = tsk.dueTime ? parseInt(tsk.dueTime.split(':')[0], 10) : 12;
                    return tskHour === hour;
                  });

                  return (
                    <div
                      key={hour}
                      onClick={() => openCreateModal(dateStr, hour)}
                      className="flex min-h-[55px] hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                    >
                      <div className="w-20 text-right pr-4 text-xs font-semibold text-stone-400 py-1 border-r border-stone-200 dark:border-stone-800 shrink-0">
                        {hourLabel}
                      </div>
                      <div className="flex-1 p-2 flex flex-col gap-1.5">
                        {hourEvents.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(ev);
                            }}
                            className="p-2.5 rounded-xl text-white font-medium text-xs shadow-xs flex items-center justify-between"
                            style={{ backgroundColor: ev.color || '#039be5' }}
                          >
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4" />
                              <span className="font-semibold text-sm">{ev.title}</span>
                              {ev.location && (
                                <span className="flex items-center gap-1 text-[11px] opacity-80">
                                  <MapPin className="w-3 h-3" />
                                  {ev.location}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] opacity-80">
                              {ev.startTime ? `${ev.startTime} – ${ev.endTime || ''}` : 'All day'}
                            </span>
                          </div>
                        ))}

                        {hourTasks.map((tsk) => (
                          <div
                            key={tsk.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(tsk);
                            }}
                            className="p-2.5 rounded-xl border border-emerald-500/50 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-medium text-xs shadow-xs flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTaskComplete(tsk.id);
                                }}
                                className="text-emerald-600"
                              >
                                <CheckSquare className="w-4 h-4" />
                              </button>
                              <span
                                className={`text-sm font-semibold ${
                                  tsk.isCompleted ? 'line-through opacity-50' : ''
                                }`}
                              >
                                {tsk.title}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-400">
                              {tsk.dueTime || 'Anytime'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================= 4. SCHEDULE / AGENDA VIEW ======================= */}
          {viewMode === 'schedule' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
              {scheduleGroups.length === 0 ? (
                <div className="text-center py-20 text-stone-400">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-base">No upcoming events or tasks</p>
                  <p className="text-xs text-stone-400 mt-1">
                    Click the &quot;Create&quot; button to add your first event or task with reminders.
                  </p>
                </div>
              ) : (
                scheduleGroups.map((group) => (
                  <div key={group.dateStr} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 bg-stone-50 dark:bg-[#18191a] py-1.5 z-10">
                      <span
                        className={`text-sm font-bold px-3 py-1 rounded-full ${
                          group.isToday
                            ? 'bg-blue-600 text-white'
                            : 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        {group.dateObj.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {group.isToday && (
                        <span className="text-xs font-semibold text-blue-600">Today</span>
                      )}
                    </div>

                    <div className="space-y-2 pl-2">
                      {/* Events */}
                      {group.events.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => openEditModal(ev)}
                          className="p-3 rounded-2xl text-white shadow-xs flex items-center justify-between cursor-pointer hover:brightness-95 transition-all"
                          style={{ backgroundColor: ev.color || '#039be5' }}
                        >
                          <div className="flex items-center gap-3">
                            <CalendarIcon className="w-5 h-5 shrink-0" />
                            <div>
                              <h4 className="font-semibold text-sm">{ev.title}</h4>
                              {ev.description && (
                                <p className="text-xs opacity-85 line-clamp-1">{ev.description}</p>
                              )}
                              {ev.location && (
                                <p className="text-[11px] opacity-80 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {ev.location}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs opacity-90">
                            <div>{ev.isAllDay ? 'All day' : `${ev.startTime || ''} – ${ev.endTime || ''}`}</div>
                            {ev.reminderMinutes !== undefined && ev.reminderMinutes >= 0 && (
                              <div className="flex items-center gap-1 text-[11px] justify-end opacity-80 mt-0.5">
                                <Bell className="w-3 h-3" />
                                {ev.reminderMinutes === 0
                                  ? 'At start'
                                  : `${ev.reminderMinutes}m before`}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Tasks */}
                      {group.tasks.map((tsk) => (
                        <div
                          key={tsk.id}
                          onClick={() => openEditModal(tsk)}
                          className="p-3 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xs flex items-center justify-between cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-750 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskComplete(tsk.id);
                              }}
                              className="text-emerald-600 dark:text-emerald-400"
                            >
                              <CheckSquare
                                className={`w-5 h-5 ${tsk.isCompleted ? 'opacity-100' : 'opacity-60'}`}
                              />
                            </button>
                            <div>
                              <h4
                                className={`font-semibold text-sm text-stone-900 dark:text-stone-100 ${
                                  tsk.isCompleted ? 'line-through opacity-50' : ''
                                }`}
                              >
                                {tsk.title}
                              </h4>
                              {tsk.description && (
                                <p className="text-xs text-stone-500 line-clamp-1">
                                  {tsk.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-stone-500">
                            <div>{tsk.dueTime ? `Due ${tsk.dueTime}` : 'Due anytime'}</div>
                            {tsk.reminderMinutes !== undefined && tsk.reminderMinutes >= 0 && (
                              <div className="flex items-center gap-1 text-[11px] justify-end text-amber-500 mt-0.5">
                                <Bell className="w-3 h-3" />
                                {tsk.reminderMinutes === 0
                                  ? 'At time'
                                  : `${tsk.reminderMinutes}m before`}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Note Reminders */}
                      {group.reminders.map((nr) => (
                        <div
                          key={nr.id}
                          onClick={() => setEditingNote(nr.note)}
                          className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 shadow-xs flex items-center justify-between cursor-pointer hover:brightness-95 transition-all text-amber-900 dark:text-amber-100"
                        >
                          <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-amber-500 shrink-0" />
                            <div>
                              <h4 className="font-semibold text-sm">{nr.title}</h4>
                              <p className="text-xs opacity-75">Google Keep Note Reminder</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {nr.timeStr}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* 3. Day "+X more" Popover Dialog */}
      {dayPopoverDate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setDayPopoverDate(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#202124] rounded-2xl p-4 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
              <span className="text-sm font-bold text-stone-800 dark:text-stone-100">
                {dayPopoverDate}
              </span>
              <button
                type="button"
                onClick={() => setDayPopoverDate(null)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {(itemsByDate.get(dayPopoverDate)?.events || []).map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    setDayPopoverDate(null);
                    openEditModal(ev);
                  }}
                  className="p-2 rounded-lg text-white font-medium text-xs truncate cursor-pointer hover:brightness-95"
                  style={{ backgroundColor: ev.color || '#039be5' }}
                >
                  {ev.startTime && <span className="opacity-80 mr-1.5">{ev.startTime}</span>}
                  {ev.title}
                </div>
              ))}

              {(itemsByDate.get(dayPopoverDate)?.tasks || []).map((tsk) => (
                <div
                  key={tsk.id}
                  onClick={() => {
                    setDayPopoverDate(null);
                    openEditModal(tsk);
                  }}
                  className="p-2 rounded-lg border border-emerald-500/50 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-medium text-xs truncate cursor-pointer flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span className={tsk.isCompleted ? 'line-through opacity-50' : ''}>
                    {tsk.title}
                  </span>
                </div>
              ))}

              {(itemsByDate.get(dayPopoverDate)?.reminders || []).map((nr) => (
                <div
                  key={nr.id}
                  onClick={() => {
                    setDayPopoverDate(null);
                    setEditingNote(nr.note);
                  }}
                  className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-400/40 font-medium text-xs truncate cursor-pointer flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>{nr.title}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const target = dayPopoverDate;
                setDayPopoverDate(null);
                openCreateModal(target);
              }}
              className="w-full py-2 rounded-xl bg-blue-600 text-white font-medium text-xs text-center"
            >
              + Add Item on this Day
            </button>
          </div>
        </div>
      )}

      {/* 4. Event / Task Creation & Edit Modal */}
      <CalendarItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        itemToEdit={itemToEdit}
        initialDate={modalInitialDate}
        initialHour={modalInitialHour}
        onSave={async (itemData) => {
          if (itemToEdit) {
            await updateCalendarItem(itemToEdit.id, itemData);
          } else {
            await addCalendarItem(itemData);
          }
        }}
        onDelete={async (id) => {
          await deleteCalendarItem(id);
        }}
      />
    </div>
  );
};
