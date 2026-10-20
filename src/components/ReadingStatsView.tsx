'use client';

import React, { useState, useMemo } from 'react';
import {
  Timer,
  BarChart2,
  Calendar,
  Clock,
  BookOpen,
  Trash2,
  Download,
  Play,
  TrendingUp,
  Folder,
  ArrowUpDown,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { ReadingSession, Note } from '@/types/note';
import { EditReadingTimeModal } from './EditReadingTimeModal';

type DateRangeFilter = 'all' | 'today' | '7days' | '30days' | 'thisMonth';

function formatSecondsToHms(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  }
  if (m > 0) {
    return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  }
  return `${s}s`;
}

function formatSessionDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today at ${timeStr}`;
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${timeStr}`;
}

export const ReadingStatsView: React.FC = () => {
  const {
    readingSessions,
    notes,
    categories,
    deleteReadingSession,
    updateReadingSession,
    updateNoteReadingTime,
    deleteNoteReadingStats,
    clearAllReadingStats,
    setEditingNote,
    startReadingStopwatch,
  } = useKeep();

  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [chartRange, setChartRange] = useState<7 | 14 | 30>(7);
  const [activeTab, setActiveTab] = useState<'overview' | 'perNote' | 'perDay' | 'sessions'>('overview');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [editingTimeTarget, setEditingTimeTarget] = useState<{
    noteId?: string;
    sessionId?: string;
    title: string;
    seconds: number;
    isSession: boolean;
  } | null>(null);

  // Filter sessions by selected date range
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return readingSessions.filter((s) => {
      if (dateRange === 'all') return true;
      if (dateRange === 'today') {
        return s.endedAt >= startOfToday;
      }
      if (dateRange === '7days') {
        const sevenDaysAgo = startOfToday - 7 * 86400000;
        return s.endedAt >= sevenDaysAgo;
      }
      if (dateRange === '30days') {
        const thirtyDaysAgo = startOfToday - 30 * 86400000;
        return s.endedAt >= thirtyDaysAgo;
      }
      if (dateRange === 'thisMonth') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return s.endedAt >= startOfMonth;
      }
      return true;
    });
  }, [readingSessions, dateRange]);

  // Overall KPIs
  const totalReadingSeconds = useMemo(
    () => filteredSessions.reduce((acc, s) => acc + s.durationSeconds, 0),
    [filteredSessions]
  );

  const todayReadingSeconds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return readingSessions
      .filter((s) => s.endedAt >= startOfToday)
      .reduce((acc, s) => acc + s.durationSeconds, 0);
  }, [readingSessions]);

  const uniqueNotesReadCount = useMemo(() => {
    const set = new Set(filteredSessions.map((s) => s.noteId));
    return set.size;
  }, [filteredSessions]);

  const averageSessionSeconds = useMemo(() => {
    if (filteredSessions.length === 0) return 0;
    return Math.round(totalReadingSeconds / filteredSessions.length);
  }, [filteredSessions, totalReadingSeconds]);

  // Per Note Aggregation
  const perNoteStats = useMemo(() => {
    const map = new Map<
      string,
      {
        noteId: string;
        title: string;
        category?: string | null;
        totalSeconds: number;
        sessionCount: number;
        lastReadAt: number;
      }
    >();

    filteredSessions.forEach((s) => {
      const existing = map.get(s.noteId);
      if (existing) {
        existing.totalSeconds += s.durationSeconds;
        existing.sessionCount += 1;
        if (s.endedAt > existing.lastReadAt) {
          existing.lastReadAt = s.endedAt;
        }
      } else {
        map.set(s.noteId, {
          noteId: s.noteId,
          title: s.noteTitle || 'Untitled Note',
          category: s.category || null,
          totalSeconds: s.durationSeconds,
          sessionCount: 1,
          lastReadAt: s.endedAt,
        });
      }
    });

    // In 'all' time view, also include notes that have accumulated reading time but no session logs yet
    if (dateRange === 'all') {
      notes.forEach((n) => {
        if (n.totalReadingTime && n.totalReadingTime > 0) {
          const existing = map.get(n.id);
          if (existing) {
            // Keep the maximum between session sum and note.totalReadingTime
            existing.totalSeconds = Math.max(existing.totalSeconds, n.totalReadingTime);
          } else {
            map.set(n.id, {
              noteId: n.id,
              title: n.title || 'Untitled Note',
              category: n.category || null,
              totalSeconds: n.totalReadingTime,
              sessionCount: 0,
              lastReadAt: n.updatedAt || n.createdAt,
            });
          }
        }
      });
    }

    const list = Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);

    if (noteSearchQuery.trim()) {
      const q = noteSearchQuery.toLowerCase().trim();
      return list.filter(
        (n) => n.title.toLowerCase().includes(q) || (n.category && n.category.toLowerCase().includes(q))
      );
    }

    return list;
  }, [filteredSessions, notes, dateRange, noteSearchQuery]);

  const topReadNote = useMemo(() => (perNoteStats.length > 0 ? perNoteStats[0] : null), [perNoteStats]);

  // Per Day Aggregation
  const perDayStats = useMemo(() => {
    const map = new Map<
      string,
      {
        dateStr: string;
        timestamp: number;
        totalSeconds: number;
        sessionCount: number;
        noteTitles: Set<string>;
      }
    >();

    filteredSessions.forEach((s) => {
      const d = s.dateStr || new Date(s.endedAt).toISOString().split('T')[0];
      const existing = map.get(d);
      if (existing) {
        existing.totalSeconds += s.durationSeconds;
        existing.sessionCount += 1;
        existing.noteTitles.add(s.noteTitle || 'Untitled Note');
      } else {
        const dateObj = new Date(s.endedAt);
        map.set(d, {
          dateStr: d,
          timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime(),
          totalSeconds: s.durationSeconds,
          sessionCount: 1,
          noteTitles: new Set([s.noteTitle || 'Untitled Note']),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredSessions]);

  // Visual chart data per day (7, 14, or 30 days)
  const chartDays = useMemo(() => {
    const days: { label: string; dateStr: string; seconds: number }[] = [];
    const now = new Date();

    for (let i = chartRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = i === 0 ? 'Today' : chartRange <= 7 ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
      const dayStat = perDayStats.find((p) => p.dateStr === dateStr);
      days.push({
        label: dayLabel,
        dateStr,
        seconds: dayStat ? dayStat.totalSeconds : 0,
      });
    }

    return days;
  }, [perDayStats, chartRange]);

  const maxChartSeconds = useMemo(() => {
    const max = Math.max(...chartDays.map((d) => d.seconds), 60);
    return max;
  }, [chartDays]);

  // Per Category Aggregation
  const perCategoryStats = useMemo(() => {
    const map = new Map<string, { categoryName: string; totalSeconds: number; sessionCount: number }>();

    filteredSessions.forEach((s) => {
      const cat = s.category || 'Uncategorized';
      const existing = map.get(cat);
      if (existing) {
        existing.totalSeconds += s.durationSeconds;
        existing.sessionCount += 1;
      } else {
        map.set(cat, {
          categoryName: cat,
          totalSeconds: s.durationSeconds,
          sessionCount: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [filteredSessions]);

  // Export Stats as CSV
  const handleExportCSV = () => {
    if (readingSessions.length === 0) {
      alert('No reading sessions to export.');
      return;
    }
    const headers = ['Session ID', 'Note Title', 'Category', 'Duration (seconds)', 'Duration (formatted)', 'Date', 'Started At', 'Ended At'];
    const rows = readingSessions.map((s) => [
      `"${s.id}"`,
      `"${(s.noteTitle || 'Untitled').replace(/"/g, '""')}"`,
      `"${(s.category || 'None').replace(/"/g, '""')}"`,
      s.durationSeconds,
      `"${formatSecondsToHms(s.durationSeconds)}"`,
      `"${s.dateStr}"`,
      `"${new Date(s.startedAt).toISOString()}"`,
      `"${new Date(s.endedAt).toISOString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `keep-reading-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenNote = (noteId: string) => {
    const found = notes.find((n) => n.id === noteId);
    if (found) {
      setEditingNote(found);
    }
  };

  const handleStartReadingNote = (noteId: string, title: string, category?: string | null) => {
    const found = notes.find((n) => n.id === noteId);
    if (found) {
      setEditingNote(found);
      startReadingStopwatch(noteId, title, category);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#202124] p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Timer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Reading Stats & Time Tracking</span>
              </h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Stopwatch time recorded while reading notes, breakdown per day and per note
              </p>
            </div>
          </div>
        </div>

        {/* Date Range Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-medium">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: '30days', label: '30 Days' },
                { id: 'thisMonth', label: 'This Month' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateRange(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                  dateRange === opt.id
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium transition-colors"
            title="Export CSV report"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold transition-colors border border-red-200 dark:border-red-900/40"
            title="Completely reset all time stats and session history"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset All Stats</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Time */}
        <div className="bg-white dark:bg-[#202124] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-medium">
            <span>Total Reading Time</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              {formatSecondsToHms(totalReadingSeconds)}
            </span>
            <div className="text-[11px] text-stone-400 mt-1">
              {filteredSessions.length} total recorded session{filteredSessions.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {/* Today's Reading */}
        <div className="bg-white dark:bg-[#202124] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-medium">
            <span>Today&apos;s Reading</span>
            <span className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              {formatSecondsToHms(todayReadingSeconds)}
            </span>
            <div className="text-[11px] text-stone-400 mt-1">
              Today across all notes
            </div>
          </div>
        </div>

        {/* Unique Notes Read */}
        <div className="bg-white dark:bg-[#202124] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-medium">
            <span>Notes Studied</span>
            <span className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <BookOpen className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              {uniqueNotesReadCount}
            </span>
            <div className="text-[11px] text-stone-400 mt-1">
              Out of {notes.filter((n) => !n.isTrash).length} total notes
            </div>
          </div>
        </div>

        {/* Average Session Length */}
        <div className="bg-white dark:bg-[#202124] p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 text-xs font-medium">
            <span>Average Session</span>
            <span className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight">
              {formatSecondsToHms(averageSessionSeconds)}
            </span>
            <div className="text-[11px] text-stone-400 mt-1">
              Avg per stopwatch session
            </div>
          </div>
        </div>
      </div>

      {/* Visual Activity Bar Chart Per Day */}
      <div className="bg-white dark:bg-[#202124] p-5 sm:p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Daily Reading Activity
            </h2>
            <span className="text-xs text-stone-400">({chartRange} Days)</span>
          </div>
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg text-xs font-medium">
            {([7, 14, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setChartRange(r)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  chartRange === r
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div
            className="flex items-end h-44 pt-6 pb-2 gap-1.5 sm:gap-3"
            style={{ minWidth: chartRange > 14 ? '700px' : 'auto' }}
          >
            {chartDays.map((cd) => {
              const minutes = Math.round(cd.seconds / 60);
              const heightPercent = maxChartSeconds > 0 ? Math.min(100, Math.round((cd.seconds / maxChartSeconds) * 100)) : 0;
              const isToday = cd.label === 'Today';

              return (
                <div key={cd.dateStr} className="flex-1 flex flex-col items-center h-full justify-end group min-w-0">
                  <div className={`text-[10px] sm:text-xs font-semibold mb-1.5 transition-colors ${
                    cd.seconds > 0 ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-stone-400'
                  }`}>
                    {cd.seconds > 0 ? (minutes > 0 ? `${minutes}m` : `${cd.seconds}s`) : '-'}
                  </div>
                  <div className="w-full max-w-[48px] bg-stone-100 dark:bg-stone-800 rounded-t-lg overflow-hidden flex flex-col justify-end h-28">
                    <div
                      style={{ height: `${Math.max(heightPercent, cd.seconds > 0 ? 8 : 2)}%` }}
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        isToday
                          ? 'bg-emerald-500 shadow-xs shadow-emerald-500/20'
                          : cd.seconds > 0
                          ? 'bg-emerald-400/80 hover:bg-emerald-400'
                          : 'bg-stone-200 dark:bg-stone-700/50'
                      }`}
                      title={`${cd.label} (${cd.dateStr}): ${formatSecondsToHms(cd.seconds)}`}
                    />
                  </div>
                  <span className={`text-[10px] sm:text-xs mt-2 truncate w-full text-center ${isToday ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-stone-500'}`}>
                    {cd.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          Overview & Categories
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('perNote')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'perNote'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <span>Per Note</span>
          <span className="text-xs px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 rounded-full">
            {perNoteStats.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('perDay')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'perDay'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <span>Per Day</span>
          <span className="text-xs px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 rounded-full">
            {perDayStats.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'sessions'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <span>Sessions Log</span>
          <span className="text-xs px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 rounded-full">
            {filteredSessions.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Overview & Categories */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Most Read Notes */}
          <div className="bg-white dark:bg-[#202124] p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                <span>Most Read Notes</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('perNote')}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                View all ({perNoteStats.length})
              </button>
            </h3>

            {perNoteStats.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                No reading sessions recorded yet. Open any note and start the stopwatch to track time!
              </div>
            ) : (
              <div className="space-y-3">
                {perNoteStats.slice(0, 5).map((stat, idx) => {
                  const percentOfTop = topReadNote ? Math.round((stat.totalSeconds / topReadNote.totalSeconds) * 100) : 100;
                  return (
                    <div
                      key={stat.noteId}
                      className="p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors group cursor-pointer border border-transparent hover:border-stone-200 dark:hover:border-stone-700/50"
                      onClick={() => handleOpenNote(stat.noteId)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-400 w-4">#{idx + 1}</span>
                          <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate max-w-[220px]">
                            {stat.title}
                          </span>
                          {stat.category && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                              {stat.category}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatSecondsToHms(stat.totalSeconds)}
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden mt-2">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${percentOfTop}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-stone-400 mt-1">
                        <span>{stat.sessionCount} session{stat.sessionCount === 1 ? '' : 's'}</span>
                        <span>Last read: {formatSessionDate(stat.lastReadAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown by Category */}
          <div className="bg-white dark:bg-[#202124] p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>Reading Time by Category</span>
            </h3>

            {perCategoryStats.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                No category data available for the selected period.
              </div>
            ) : (
              <div className="space-y-4">
                {perCategoryStats.map((cat) => {
                  const catObj = categories.find((c) => c.name === cat.categoryName);
                  const percentOfTotal = totalReadingSeconds > 0 ? Math.round((cat.totalSeconds / totalReadingSeconds) * 100) : 0;

                  return (
                    <div key={cat.categoryName} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                          <span>{catObj?.icon || '📁'}</span>
                          <span>{cat.categoryName}</span>
                          <span className="text-[10px] text-stone-400 font-normal">
                            ({cat.sessionCount} sessions)
                          </span>
                        </span>
                        <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                          {formatSecondsToHms(cat.totalSeconds)} ({percentOfTotal}%)
                        </span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentOfTotal}%`,
                            backgroundColor: catObj?.color || '#10b981',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Per Note Breakdown */}
      {activeTab === 'perNote' && (
        <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
          {/* Table Header & Search */}
          <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search notes or categories..."
                value={noteSearchQuery}
                onChange={(e) => setNoteSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs outline-none text-stone-800 dark:text-stone-200 placeholder:text-stone-400"
              />
            </div>
            <span className="text-xs text-stone-400">
              Showing {perNoteStats.length} notes sorted by reading time
            </span>
          </div>

          {perNoteStats.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              No notes matched your search query or filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 font-semibold border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Note Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Total Time</th>
                    <th className="py-3 px-4 text-center">Sessions</th>
                    <th className="py-3 px-4">Last Read</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-stone-700 dark:text-stone-300">
                  {perNoteStats.map((stat, idx) => (
                    <tr
                      key={stat.noteId}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-bold text-stone-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-semibold text-stone-900 dark:text-stone-100 max-w-xs truncate">
                        <button
                          type="button"
                          onClick={() => handleOpenNote(stat.noteId)}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 text-left truncate block w-full"
                        >
                          {stat.title}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        {stat.category ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                            {stat.category}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatSecondsToHms(stat.totalSeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium">
                        {stat.sessionCount}
                      </td>
                      <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                        {formatSessionDate(stat.lastReadAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartReadingNote(stat.noteId, stat.title, stat.category)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold transition-colors"
                            title="Open note and start stopwatch"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Read</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTimeTarget({
                                noteId: stat.noteId,
                                title: stat.title,
                                seconds: stat.totalSeconds,
                                isSession: false,
                              })
                            }
                            className="p-1.5 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                            title="Edit reading time for this note"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTimeTarget({
                                noteId: stat.noteId,
                                title: stat.title,
                                seconds: stat.totalSeconds,
                                isSession: false,
                              })
                            }
                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Delete / reset time stats for this note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Per Day Breakdown */}
      {activeTab === 'perDay' && (
        <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>Daily Reading Breakdown</span>
            </h3>
            <span className="text-xs text-stone-400">{perDayStats.length} active reading days</span>
          </div>

          {perDayStats.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              No daily reading recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 font-semibold border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Total Time</th>
                    <th className="py-3 px-4 text-center">Sessions</th>
                    <th className="py-3 px-4">Notes Studied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-stone-700 dark:text-stone-300">
                  {perDayStats.map((day) => {
                    const dateObj = new Date(day.timestamp);
                    const now = new Date();
                    const isToday = dateObj.toDateString() === now.toDateString();
                    const isYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() === dateObj.toDateString();

                    const dateLabel = isToday
                      ? 'Today'
                      : isYesterday
                      ? 'Yesterday'
                      : dateObj.toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });

                    return (
                      <tr key={day.dateStr} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-stone-900 dark:text-stone-100">
                          <div className="flex items-center gap-2">
                            <span>{dateLabel}</span>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatSecondsToHms(day.totalSeconds)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium">
                          {day.sessionCount}
                        </td>
                        <td className="py-3.5 px-4 text-stone-500 max-w-sm truncate">
                          {Array.from(day.noteTitles).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Individual Sessions Log */}
      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>Recorded Stopwatch Sessions</span>
            </h3>
            <span className="text-xs text-stone-400">{filteredSessions.length} sessions</span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              No sessions found for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 font-semibold border-b border-stone-200 dark:border-stone-800">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Note Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Duration</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 text-stone-700 dark:text-stone-300">
                  {filteredSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                        {formatSessionDate(session.endedAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-stone-900 dark:text-stone-100 max-w-xs truncate">
                        <button
                          type="button"
                          onClick={() => handleOpenNote(session.noteId)}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 text-left truncate block w-full"
                        >
                          {session.noteTitle || 'Untitled Note'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {session.category ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                            {session.category}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatSecondsToHms(session.durationSeconds)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTimeTarget({
                                sessionId: session.id,
                                noteId: session.noteId,
                                title: session.noteTitle || 'Reading Session',
                                seconds: session.durationSeconds,
                                isSession: true,
                              })
                            }
                            className="p-1 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md transition-colors"
                            title="Edit session duration"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Delete this reading session record?')) {
                                deleteReadingSession(session.id);
                              }
                            }}
                            className="p-1 text-stone-400 hover:text-red-500 rounded-md transition-colors"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal to Clear All History */}
      {confirmClearOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#28292c] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-700 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                Clear All Reading Stats?
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              This will permanently delete all {readingSessions.length} recorded reading sessions and reset total reading times on all notes. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await clearAllReadingStats();
                  setConfirmClearOpen(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Reading Time Modal */}
      {editingTimeTarget && (
        <EditReadingTimeModal
          isOpen={true}
          onClose={() => setEditingTimeTarget(null)}
          title={editingTimeTarget.title}
          initialSeconds={editingTimeTarget.seconds}
          isSession={editingTimeTarget.isSession}
          onSave={async (newSeconds) => {
            if (editingTimeTarget.isSession && editingTimeTarget.sessionId) {
              await updateReadingSession(editingTimeTarget.sessionId, newSeconds);
            } else if (editingTimeTarget.noteId) {
              await updateNoteReadingTime(editingTimeTarget.noteId, newSeconds);
            }
          }}
          onDeleteStats={
            !editingTimeTarget.isSession && editingTimeTarget.noteId
              ? async () => {
                  if (editingTimeTarget.noteId) {
                    await deleteNoteReadingStats(editingTimeTarget.noteId);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
