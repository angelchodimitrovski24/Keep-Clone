'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Download,
  ExternalLink,
  Search,
  User,
  Calendar,
  Clock,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  Settings,
  Paperclip,
  FileText,
  Sparkles,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import {
  getSavedJiraConfig,
  searchJiraJql,
  fetchJiraIssue,
  batchDownloadJiraIssues,
  JiraConfig,
  JiraIssueSummary,
  JiraNotePayload,
} from '@/lib/jiraClient';
import { convertMarkdownToHtml } from '@/lib/formatUtils';
import { Note } from '@/types/note';

type TimeWindowDays = 1 | 3 | 7 | 14 | 30;

function formatJiraDateTime(iso?: string, fallback?: string): { date: string; time: string } {
  if (!iso) {
    return { date: fallback || 'Unknown', time: '' };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: fallback || iso, time: '' };
  }
  return {
    date: d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function getStatusBadgeClasses(statusCategory: string, statusName: string): string {
  const cat = (statusCategory || '').toLowerCase();
  const name = (statusName || '').toLowerCase();

  if (cat === 'done' || name.includes('done') || name.includes('closed') || name.includes('resolved')) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }
  if (
    cat === 'indeterminate' ||
    name.includes('progress') ||
    name.includes('review') ||
    name.includes('qa') ||
    name.includes('test')
  ) {
    return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
  }
  return 'bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30';
}

function normalizeJiraBrowseBase(baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const PsiDashboardView: React.FC = () => {
  const {
    notes,
    categories,
    defaultCategory,
    selectedCategory,
    addNote,
    setEditingNote,
    isJiraModalOpen,
    setIsJiraModalOpen,
  } = useKeep();

  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [daysWindow, setDaysWindow] = useState<TimeWindowDays>(3);
  const [includeUpdated, setIncludeUpdated] = useState(true);
  const [issues, setIssues] = useState<JiraIssueSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Local UI filtering
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selection & Fetch Options
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [downloadAttachments, setDownloadAttachments] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [targetCategory, setTargetCategory] = useState<string>('');

  // Fetch Progress State
  const [isFetchingSelected, setIsFetchingSelected] = useState(false);
  const [fetchingSingleKey, setFetchingSingleKey] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const prevJiraModalOpenRef = useRef(isJiraModalOpen);

  // Initialize default target category
  useEffect(() => {
    if (!targetCategory) {
      const workCat = categories.find((c) => c.name.toLowerCase() === 'work')?.name;
      setTargetCategory(workCat || selectedCategory || defaultCategory || 'Work');
    }
  }, [categories, selectedCategory, defaultCategory, targetCategory]);

  // Core fetch function for PSI issues
  const loadPsiIssues = useCallback(
    async (configOverride?: JiraConfig | null, days: TimeWindowDays = daysWindow, alsoUpdated: boolean = includeUpdated) => {
      const activeConfig = configOverride !== undefined ? configOverride : getSavedJiraConfig();
      setJiraConfig(activeConfig);

      if (!activeConfig || !activeConfig.baseUrl || !activeConfig.email || !activeConfig.apiToken) {
        setIssues([]);
        setTotalCount(0);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      const dateFilter = alsoUpdated
        ? `(created >= -${days}d OR updated >= -${days}d)`
        : `created >= -${days}d`;
      const jql = `project = PSI AND ${dateFilter} ORDER BY updated DESC`;

      try {
        const res = await searchJiraJql(activeConfig, jql, 0);
        setIssues(res.issues || []);
        setTotalCount(res.total || (res.issues ? res.issues.length : 0));
        setLastRefreshedAt(new Date());
        // Preserve only keys still present in new results
        const returnedKeys = new Set((res.issues || []).map((i) => i.key));
        setSelectedKeys((prev) => {
          const next = new Set<string>();
          prev.forEach((k) => {
            if (returnedKeys.has(k)) next.add(k);
          });
          return next;
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to load PSI issues from Jira.');
      } finally {
        setIsLoading(false);
      }
    },
    [daysWindow, includeUpdated]
  );

  // Immediately load PSI issues when dashboard opens or timeframe changes
  useEffect(() => {
    const saved = getSavedJiraConfig();
    loadPsiIssues(saved, daysWindow, includeUpdated);
  }, [daysWindow, includeUpdated, loadPsiIssues]);

  // Auto-refresh when returning from Jira Settings modal (if user just saved credentials)
  useEffect(() => {
    if (prevJiraModalOpenRef.current && !isJiraModalOpen) {
      const saved = getSavedJiraConfig();
      loadPsiIssues(saved, daysWindow, includeUpdated);
    }
    prevJiraModalOpenRef.current = isJiraModalOpen;
  }, [isJiraModalOpen, daysWindow, includeUpdated, loadPsiIssues]);

  // Map existing non-trashed Keep notes by Jira key (e.g. PSI-115)
  const existingNoteByKey = useMemo(() => {
    const map = new Map<string, Note>();
    for (const n of notes) {
      if (n.isTrash) continue;
      const titleMatch = (n.title || '').match(/\b(PSI-\d+)\b/i);
      if (titleMatch) {
        const keyUpper = titleMatch[1].toUpperCase();
        if (!map.has(keyUpper)) map.set(keyUpper, n);
        continue;
      }
      if (Array.isArray(n.labels)) {
        for (const lbl of n.labels) {
          if (/^psi-\d+$/i.test(lbl)) {
            const keyUpper = lbl.toUpperCase();
            if (!map.has(keyUpper)) map.set(keyUpper, n);
          }
        }
      }
    }
    return map;
  }, [notes]);

  // Distinct statuses from loaded issues
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const iss of issues) {
      if (iss.status) set.add(iss.status);
    }
    return Array.from(set);
  }, [issues]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return issues.filter((iss) => {
      if (statusFilter !== 'ALL' && iss.status !== statusFilter) return false;
      if (!q) return true;
      return (
        iss.key.toLowerCase().includes(q) ||
        iss.summary.toLowerCase().includes(q) ||
        iss.assignee.toLowerCase().includes(q) ||
        iss.status.toLowerCase().includes(q)
      );
    });
  }, [issues, filterText, statusFilter]);

  // Summary breakdown
  const statsSummary = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    for (const iss of issues) {
      const cat = (iss.statusCategory || '').toLowerCase();
      if (cat === 'done') done++;
      else if (cat === 'indeterminate') inProgress++;
      else todo++;
    }
    return { total: issues.length, todo, inProgress, done };
  }, [issues]);

  const allVisibleSelected =
    filteredIssues.length > 0 && filteredIssues.every((i) => selectedKeys.has(i.key));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        filteredIssues.forEach((i) => next.delete(i.key));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        filteredIssues.forEach((i) => next.add(i.key));
        return next;
      });
    }
  };

  const toggleSelectNotFetched = () => {
    const unfetched = filteredIssues.filter((i) => !existingNoteByKey.has(i.key.toUpperCase()));
    setSelectedKeys(new Set(unfetched.map((i) => i.key)));
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const createKeepNoteFromJira = async (payload: JiraNotePayload): Promise<Note> => {
    const htmlContent = convertMarkdownToHtml(payload.markdown);
    const chosenCategory =
      categories.find((c) => c.name.toLowerCase() === (targetCategory || 'Work').toLowerCase())?.name ||
      targetCategory ||
      'Work';

    return await addNote({
      id: `jira-${payload.key.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title,
      content: htmlContent,
      isList: false,
      todos: [],
      color: 'default',
      theme: 'none',
      category: chosenCategory,
      labels: payload.labels,
      isPinned: false,
      images: [], // Images stay inline inside note content
      drawings: [],
      linkedNoteIds: [],
      childNoteIds: [],
      noteType: 'default',
      isArchived: false,
      isTrash: false,
    });
  };

  const handleFetchSingle = async (issueKey: string) => {
    if (!jiraConfig) return;
    setFetchingSingleKey(issueKey);
    setFetchMessage(null);

    try {
      const notePayload = await fetchJiraIssue(
        jiraConfig,
        issueKey,
        downloadAttachments,
        includeComments
      );
      await createKeepNoteFromJira(notePayload);
      setFetchMessage({
        type: 'success',
        text: `Fetched ${issueKey} into Keep notes (${targetCategory || 'Work'}).`,
      });
    } catch (err: any) {
      setFetchMessage({
        type: 'error',
        text: `Failed fetching ${issueKey}: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setFetchingSingleKey(null);
    }
  };

  const handleFetchSelected = async () => {
    if (!jiraConfig || selectedKeys.size === 0) return;
    const keysToFetch = Array.from(selectedKeys);
    setIsFetchingSelected(true);
    setFetchMessage(null);

    try {
      if (keysToFetch.length === 1) {
        const notePayload = await fetchJiraIssue(
          jiraConfig,
          keysToFetch[0],
          downloadAttachments,
          includeComments
        );
        await createKeepNoteFromJira(notePayload);
        setFetchMessage({
          type: 'success',
          text: `Successfully fetched ${keysToFetch[0]} into Keep notes.`,
        });
      } else {
        const batchRes = await batchDownloadJiraIssues(
          jiraConfig,
          keysToFetch,
          downloadAttachments,
          includeComments
        );
        let importedCount = 0;
        for (const payload of batchRes.notes) {
          await createKeepNoteFromJira(payload);
          importedCount++;
        }
        if (batchRes.errors && batchRes.errors.length > 0) {
          setFetchMessage({
            type: importedCount > 0 ? 'success' : 'error',
            text: `Fetched ${importedCount} of ${keysToFetch.length} PSI issues (${batchRes.errors.length} failed).`,
          });
        } else {
          setFetchMessage({
            type: 'success',
            text: `Successfully fetched ${importedCount} PSI issues into Keep notes.`,
          });
        }
      }
      setSelectedKeys(new Set());
    } catch (err: any) {
      setFetchMessage({
        type: 'error',
        text: err?.message || 'Batch fetch failed.',
      });
    } finally {
      setIsFetchingSelected(false);
    }
  };

  const browseBase = jiraConfig ? normalizeJiraBrowseBase(jiraConfig.baseUrl) : '';
  const isConfigured = Boolean(
    jiraConfig && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken
  );

  return (
    <div className="w-full max-w-6xl mx-auto py-2 sm:py-4 space-y-5 animate-in fade-in duration-150">
      {/* Top Dashboard Header */}
      <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
              PSI
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                  PSI Jira Dashboard
                </h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  project = PSI
                </span>
                {lastRefreshedAt && (
                  <span className="text-[11px] text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
                Automatically lists PSI Jira documents created or updated in the last {daysWindow}{' '}
                {daysWindow === 1 ? 'day' : 'days'}. Select any issues to fetch directly into your local notes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsJiraModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configure Jira Domain, Email & API Token"
            >
              <Settings className="w-3.5 h-3.5" />
              Jira Settings
            </button>
            {isConfigured && (
              <button
                type="button"
                onClick={() => loadPsiIssues()}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          </div>
        </div>

        {/* Summary & Window Controls */}
        {isConfigured && (
          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Time Window Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Range:
              </span>
              {([1, 3, 7, 14, 30] as TimeWindowDays[]).map((d) => {
                const active = daysWindow === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysWindow(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                    }`}
                  >
                    {d === 1 ? 'Last 24h' : `Last ${d} Days`}
                  </button>
                );
              })}

              <label className="ml-2 inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeUpdated}
                  onChange={(e) => setIncludeUpdated(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600"
                />
                <span>Created or Updated</span>
              </label>
            </div>

            {/* Quick Status Counters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold">
                Total: {statsSummary.total}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-500/10 text-stone-700 dark:text-stone-300 font-medium">
                To Do: {statsSummary.todo}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
                In Progress: {statsSummary.inProgress}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
                Done: {statsSummary.done}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Unconfigured State */}
      {!isConfigured ? (
        <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 p-8 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Settings className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              Connect Jira to View PSI Documents
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
              Enter your Atlassian domain, email, and API token once in Jira Settings to automatically load recent PSI issues here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsJiraModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Connect Jira Account
          </button>
        </div>
      ) : (
        <>
          {/* Fetch Feedback Banner */}
          {fetchMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
                fetchMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {fetchMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{fetchMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFetchMessage(null)}
                className="text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsJiraModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-xs font-semibold cursor-pointer"
                >
                  Check Credentials
                </button>
                <button
                  type="button"
                  onClick={() => loadPsiIssues()}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Filter + Batch Fetch Toolbar */}
          <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 p-3.5 sm:p-4 space-y-3 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Filter inputs */}
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter by key (e.g. PSI-115), summary, assignee..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs sm:text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs sm:text-sm text-stone-800 dark:text-stone-200 outline-none"
                >
                  <option value="ALL">All Statuses ({issues.length})</option>
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulk Fetch Action */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectNotFetched}
                  className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
                  title="Select only PSI issues not yet imported into Keep"
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                  Select Unfetched
                </button>
                <button
                  type="button"
                  onClick={handleFetchSelected}
                  disabled={selectedKeys.size === 0 || isFetchingSelected}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  {isFetchingSelected ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Fetching ({selectedKeys.size})...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Fetch Selected ({selectedKeys.size})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Fetch Options Row */}
            <div className="pt-2.5 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-4 text-xs text-stone-600 dark:text-stone-400">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={downloadAttachments}
                  onChange={(e) => setDownloadAttachments(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600"
                />
                <span>Download attachments &amp; images locally</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeComments}
                  onChange={(e) => setIncludeComments(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600"
                />
                <span>Include ticket comments</span>
              </label>

              <div className="inline-flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-stone-400" />
                <span>Save into category:</span>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs font-medium text-stone-800 dark:text-stone-200 outline-none"
                >
                  {!categories.some((c) => c.name.toLowerCase() === 'work') && (
                    <option value="Work">Work</option>
                  )}
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Issues List Table */}
          <div className="bg-white dark:bg-[#202124] rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  Loading PSI issues from the last {daysWindow} {daysWindow === 1 ? 'day' : 'days'}...
                </p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="py-16 text-center space-y-2 px-4">
                <FileText className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600" />
                <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                  No PSI issues found
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                  {issues.length > 0
                    ? 'No loaded PSI issues match your current search or status filter.'
                    : `No PSI Jira documents were ${includeUpdated ? 'created or updated' : 'created'} in the last ${daysWindow} ${daysWindow === 1 ? 'day' : 'days'}.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-900/70 border-b border-stone-200 dark:border-stone-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      <th className="py-3 pl-4 pr-2 w-10">
                        <button
                          type="button"
                          onClick={toggleSelectAllVisible}
                          className="flex items-center justify-center text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
                          title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                        >
                          {allVisibleSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-3 whitespace-nowrap">Document Key</th>
                      <th className="py-3 px-3">Summary</th>
                      <th className="py-3 px-3 whitespace-nowrap">Assignee</th>
                      <th className="py-3 px-3 whitespace-nowrap">Status</th>
                      <th className="py-3 px-3 whitespace-nowrap">Created Date</th>
                      <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">Fetch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 text-xs sm:text-sm">
                    {filteredIssues.map((issue) => {
                      const isSelected = selectedKeys.has(issue.key);
                      const existingNote = existingNoteByKey.get(issue.key.toUpperCase());
                      const createdFmt = formatJiraDateTime(issue.createdIso, issue.created);
                      const updatedFmt = formatJiraDateTime(issue.updatedIso, issue.updated);
                      const isThisFetching = fetchingSingleKey === issue.key;

                      return (
                        <tr
                          key={issue.key}
                          onClick={() => toggleKey(issue.key)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/25'
                              : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 pl-4 pr-2 align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                            />
                          </td>

                          {/* Key + Link */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                {issue.key}
                              </span>
                              {browseBase && (
                                <a
                                  href={`${browseBase}/browse/${issue.key}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5"
                                  title={`Open ${issue.key} in Jira`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              {issue.issueType}
                              {issue.attachmentCount > 0 && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5">
                                  <Paperclip className="w-2.5 h-2.5" />
                                  {issue.attachmentCount}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Summary */}
                          <td className="py-3 px-3 align-middle max-w-md">
                            <div
                              className="font-medium text-stone-900 dark:text-stone-100 line-clamp-2"
                              title={issue.summary}
                            >
                              {issue.summary}
                            </div>
                          </td>

                          {/* Assignee */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-200 text-xs">
                              <span className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {issue.assignee && issue.assignee !== 'Unassigned'
                                  ? issue.assignee
                                      .split(' ')
                                      .map((p) => p[0])
                                      .slice(0, 2)
                                      .join('')
                                      .toUpperCase()
                                  : <User className="w-3 h-3" />}
                              </span>
                              <span className={issue.assignee === 'Unassigned' ? 'text-stone-400 italic' : ''}>
                                {issue.assignee || 'Unassigned'}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(
                                issue.statusCategory,
                                issue.status
                              )}`}
                            >
                              {issue.status}
                            </span>
                          </td>

                          {/* Created Date */}
                          <td className="py-3 px-3 align-middle whitespace-nowrap">
                            <div className="text-xs font-medium text-stone-800 dark:text-stone-200">
                              {createdFmt.date}
                              {createdFmt.time && (
                                <span className="text-stone-400 ml-1 text-[11px]">{createdFmt.time}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              Updated: {updatedFmt.date}
                            </div>
                          </td>

                          {/* Action */}
                          <td
                            className="py-3 pl-3 pr-4 align-middle text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {existingNote ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingNote(existingNote)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Open existing Keep note"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Open Note
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFetchSingle(issue.key)}
                                  disabled={isThisFetching || isFetchingSelected}
                                  className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer disabled:opacity-40"
                                  title="Re-fetch latest version from Jira"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isThisFetching ? 'animate-spin' : ''}`} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFetchSingle(issue.key)}
                                disabled={isThisFetching || isFetchingSelected}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                              >
                                {isThisFetching ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Fetching...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    Fetch
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer count */}
            {!isLoading && filteredIssues.length > 0 && (
              <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-900/50 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span>
                  Showing {filteredIssues.length} of {issues.length} loaded PSI issues
                  {totalCount > issues.length ? ` (${totalCount} total matched)` : ''}
                </span>
                <span>{selectedKeys.size} selected for batch fetch</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
