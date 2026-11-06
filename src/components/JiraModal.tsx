import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Download,
  Key,
  Globe,
  Tag,
  CheckSquare,
  Square,
  FileText,
  User,
  Clock,
  Sparkles,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  JiraConfig,
  JiraUser,
  JiraIssueSummary,
  JiraNotePayload,
  getSavedJiraConfig,
  saveJiraConfig,
  clearJiraConfig,
  testJiraConnection,
  searchJiraJql,
  fetchJiraIssue,
  batchDownloadJiraIssues,
} from '@/lib/jiraClient';
import { convertMarkdownToHtml } from '@/lib/formatUtils';
import { useKeep } from '@/context/KeepContext';

interface JiraModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JiraModal: React.FC<JiraModalProps> = ({ isOpen, onClose }) => {
  const { addNote, categories } = useKeep();

  const [activeTab, setActiveTab] = useState<'download' | 'credentials'>('download');

  // Credentials State
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [connectedUser, setConnectedUser] = useState<JiraUser | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Download State
  const [downloadMode, setDownloadMode] = useState<'keys' | 'jql'>('keys');
  const [issueKeysInput, setIssueKeysInput] = useState('');
  const [jqlQuery, setJqlQuery] = useState('assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<JiraIssueSummary[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState<number | null>(null);
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<Set<string>>(new Set());
  const [downloadAttachments, setDownloadAttachments] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);

  // Progress & Execution
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Load saved config on mount
  useEffect(() => {
    const saved = getSavedJiraConfig();
    if (saved) {
      setBaseUrl(saved.baseUrl);
      setEmail(saved.email);
      setApiToken(saved.apiToken);
      // Auto-verify connection silently
      testJiraConnection(saved).then((res) => {
        if (res.success && res.user) {
          setConnectedUser(res.user);
        }
      });
    } else {
      setActiveTab('credentials');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentConfig: JiraConfig = {
    baseUrl: baseUrl.trim(),
    email: email.trim(),
    apiToken: apiToken.trim(),
  };

  const isConfigured = Boolean(baseUrl.trim() && email.trim() && apiToken.trim());

  const handleTestConnection = async () => {
    if (!isConfigured) {
      setTestResult({ success: false, message: 'Please enter Domain, Email, and API Token.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testJiraConnection(currentConfig);
    setIsTesting(false);

    if (res.success && res.user) {
      setConnectedUser(res.user);
      saveJiraConfig(currentConfig);
      setTestResult({
        success: true,
        message: `Connected successfully as ${res.user.displayName} (${res.user.emailAddress})`,
      });
    } else {
      setConnectedUser(null);
      setTestResult({
        success: false,
        message: res.error || 'Connection failed. Please check your credentials.',
      });
    }
  };

  const handleSaveCredentials = () => {
    if (!isConfigured) return;
    saveJiraConfig(currentConfig);
    handleTestConnection();
  };

  const handleClearCredentials = () => {
    clearJiraConfig();
    setBaseUrl('');
    setEmail('');
    setApiToken('');
    setConnectedUser(null);
    setTestResult(null);
  };

  const handleSearchJql = async (customJql?: string) => {
    const q = customJql !== undefined ? customJql : jqlQuery;
    if (!isConfigured) {
      setActiveTab('credentials');
      return;
    }

    setIsSearching(true);
    setDownloadError(null);
    setDownloadSuccessMsg(null);

    try {
      // Pass 0 to fetch all matching issues up to system limit
      const res = await searchJiraJql(currentConfig, q, 0);
      setSearchResults(res.issues);
      setSearchTotalCount(res.total);
      // Select all by default
      setSelectedIssueKeys(new Set(res.issues.map((i) => i.key)));
    } catch (err: any) {
      setDownloadError(err?.message || 'JQL Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIssueKeys.size === searchResults.length) {
      setSelectedIssueKeys(new Set());
    } else {
      setSelectedIssueKeys(new Set(searchResults.map((i) => i.key)));
    }
  };

  const handleToggleIssueKey = (key: string) => {
    setSelectedIssueKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const createKeepNoteFromJira = async (payload: JiraNotePayload) => {
    const htmlContent = convertMarkdownToHtml(payload.markdown);
    const workCategory = categories.find((c) => c.name.toLowerCase() === 'work')?.name || 'Work';

    await addNote({
      id: `jira-${payload.key.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title,
      content: htmlContent,
      isList: false,
      todos: [],
      color: 'default',
      theme: 'none',
      category: workCategory,
      labels: payload.labels,
      isPinned: false,
      images: [], // Images are already embedded inline in content
      drawings: [],
      linkedNoteIds: [],
      childNoteIds: [],
      noteType: 'default',
      isArchived: false,
      isTrash: false,
    });
  };

  const handleDownload = async () => {
    if (!isConfigured) {
      setActiveTab('credentials');
      return;
    }

    let keysToFetch: string[] = [];
    if (downloadMode === 'keys') {
      keysToFetch = issueKeysInput
        .split(/[,\s]+/)
        .map((k) => k.trim().toUpperCase())
        .filter(Boolean);
    } else {
      keysToFetch = Array.from(selectedIssueKeys);
    }

    if (keysToFetch.length === 0) {
      setDownloadError('Please specify or select at least one issue key.');
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccessMsg(null);
    setDownloadProgress(`Fetching ${keysToFetch.length} Jira tickets...`);

    try {
      if (keysToFetch.length === 1) {
        setDownloadProgress(`Downloading ${keysToFetch[0]} and attachments...`);
        const notePayload = await fetchJiraIssue(
          currentConfig,
          keysToFetch[0],
          downloadAttachments,
          includeComments
        );
        await createKeepNoteFromJira(notePayload);
        setDownloadSuccessMsg(`✓ Successfully imported [${keysToFetch[0]}] as a new note with local images!`);
      } else {
        setDownloadProgress(`Downloading ${keysToFetch.length} issues in batch...`);
        const batchRes = await batchDownloadJiraIssues(
          currentConfig,
          keysToFetch,
          downloadAttachments,
          includeComments
        );

        let createdCount = 0;
        for (const notePayload of batchRes.notes) {
          await createKeepNoteFromJira(notePayload);
          createdCount++;
        }

        setDownloadSuccessMsg(`✓ Successfully imported ${createdCount} Jira tickets as notes with local attachments!`);
      }
    } catch (err: any) {
      console.error('Download Jira error:', err);
      setDownloadError(err?.message || 'Failed downloading Jira issues');
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-stone-50 dark:bg-stone-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md font-bold text-sm">
              J
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Atlassian Jira Manager
                {connectedUser && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Download Jira tickets, sprints, and attachments directly into local notes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-black/10 dark:border-white/10 px-5 bg-stone-100/50 dark:bg-stone-800/30">
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'download'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Tickets &amp; JQL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-3.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'credentials'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Key className="w-4 h-4" />
            API Token &amp; Credentials
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: DOWNLOAD DATA */}
          {activeTab === 'download' && (
            <div className="space-y-4">
              {!isConfigured && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                  <span>Jira credentials not configured yet.</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credentials')}
                    className="font-bold underline hover:opacity-80"
                  >
                    Enter API Token →
                  </button>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
                <button
                  type="button"
                  onClick={() => setDownloadMode('keys')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    downloadMode === 'keys'
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  By Issue Key (Single or Multiple)
                </button>
                <button
                  type="button"
                  onClick={() => setDownloadMode('jql')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    downloadMode === 'jql'
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  JQL Search &amp; Bulk Select
                </button>
              </div>

              {/* Mode 1: Issue Keys Input */}
              {downloadMode === 'keys' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Jira Issue Key(s)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PROJ-101, PROJ-102, PROJ-105"
                    value={issueKeysInput}
                    onChange={(e) => setIssueKeysInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-2xs text-stone-500 dark:text-stone-400">
                    Enter one or multiple comma-separated Jira issue keys.
                  </p>
                </div>
              )}

              {/* Mode 2: JQL Search */}
              {downloadMode === 'jql' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Jira Query Language (JQL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="assignee = currentUser() AND status != Done"
                        value={jqlQuery}
                        onChange={(e) => setJqlQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchJql()}
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleSearchJql()}
                        disabled={isSearching}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'My Open Issues', q: 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC' },
                      { label: 'In Progress', q: 'status = "In Progress" ORDER BY updated DESC' },
                      { label: 'Updated This Week', q: 'updated >= -7d ORDER BY updated DESC' },
                      { label: 'High Priority', q: 'priority in (High, Highest) AND statusCategory != Done' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setJqlQuery(preset.q);
                          handleSearchJql(preset.q);
                        }}
                        className="px-2.5 py-1 text-2xs rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Results List */}
                  {searchResults.length > 0 && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-stone-50 dark:bg-stone-850 border-b border-stone-200 dark:border-stone-800 text-2xs font-semibold text-stone-600 dark:text-stone-400">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="flex items-center gap-1.5 hover:text-stone-900 dark:hover:text-stone-100"
                        >
                          {selectedIssueKeys.size === searchResults.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                          <span>
                            Select All ({selectedIssueKeys.size}/{searchResults.length})
                          </span>
                        </button>
                        <span>
                          {searchResults.length} Matching Issues
                          {searchTotalCount !== null && searchTotalCount > searchResults.length && (
                            <span className="text-stone-400 font-normal ml-1">
                              (of {searchTotalCount} total)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                        {searchResults.map((issue) => {
                          const isChecked = selectedIssueKeys.has(issue.key);
                          return (
                            <div
                              key={issue.key}
                              onClick={() => handleToggleIssueKey(issue.key)}
                              className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="w-3.5 h-3.5 rounded text-blue-600"
                                />
                                <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0 font-mono">
                                  {issue.key}
                                </span>
                                <span className="truncate text-stone-800 dark:text-stone-200" title={issue.summary}>
                                  {issue.summary}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-2xs">
                                <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                  {issue.status}
                                </span>
                                {issue.attachmentCount > 0 && (
                                  <span className="text-stone-400" title={`${issue.attachmentCount} attachments`}>
                                    📎 {issue.attachmentCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Download Options */}
              <div className="p-3 rounded-xl bg-stone-50/50 dark:bg-stone-850/50 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadAttachments}
                    onChange={(e) => setDownloadAttachments(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600"
                  />
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    Download and save ticket screenshots / attachments into local-media folder
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeComments}
                    onChange={(e) => setIncludeComments(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600"
                  />
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    Include ticket comments in the note
                  </span>
                </label>
              </div>

              {/* Feedback */}
              {downloadError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{downloadError}</span>
                </div>
              )}

              {downloadSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{downloadSuccessMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREDENTIALS & API TOKEN */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200">
                <p className="font-semibold mb-1">How to connect your Jira account:</p>
                <ol className="list-decimal list-inside space-y-1 text-2xs opacity-90">
                  <li>Enter your Atlassian Cloud domain (e.g. <code>mycompany.atlassian.net</code>).</li>
                  <li>Enter your Atlassian account email address.</li>
                  <li>
                    Generate an API token at{' '}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold inline-flex items-center gap-0.5"
                    >
                      id.atlassian.com/manage-profile/security/api-tokens <ExternalLink className="w-2.5 h-2.5" />
                    </a>{' '}
                    and paste it below.
                  </li>
                </ol>
              </div>

              {/* Connected User Profile Banner */}
              {connectedUser && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {connectedUser.avatarUrl ? (
                      <img src={connectedUser.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        {connectedUser.displayName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        {connectedUser.displayName}
                      </h4>
                      <p className="text-2xs text-emerald-700 dark:text-emerald-400">
                        {connectedUser.emailAddress} {connectedUser.timeZone ? `• ${connectedUser.timeZone}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    title="Disconnect Jira account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Jira URL or Domain
                  </label>
                  <input
                    type="text"
                    placeholder="https://your-company.atlassian.net"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Atlassian Account Email
                  </label>
                  <input
                    type="email"
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Jira API Token
                    </label>
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      Create API Token <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="Paste Atlassian API Token..."
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !isConfigured}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  disabled={!isConfigured}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  Save Credentials
                </button>
              </div>

              {/* Test Result Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/10 dark:border-white/10 bg-stone-50 dark:bg-stone-850">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {isDownloading ? (
              <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {downloadProgress}
              </span>
            ) : connectedUser ? (
              <span>Logged in to {baseUrl.replace(/^https?:\/\//, '')}</span>
            ) : (
              <span>Enter API token to download Jira issues</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-750 transition-colors"
            >
              Close
            </button>

            {activeTab === 'download' && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading || !isConfigured}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download to Notes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
