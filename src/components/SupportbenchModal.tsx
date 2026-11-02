import React, { useState, useEffect, useRef } from 'react';
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
  Headphones,
  FolderOpen,
} from 'lucide-react';
import {
  SupportbenchConfig,
  SupportbenchUser,
  SupportbenchCaseSummary,
  SupportbenchNotePayload,
  getSavedSupportbenchConfig,
  saveSupportbenchConfig,
  clearSupportbenchConfig,
  testSupportbenchConnection,
  searchSupportbenchCases,
  fetchSupportbenchCase,
  batchDownloadSupportbenchCases,
} from '@/lib/supportbenchClient';
import { convertMarkdownToHtml } from '@/lib/formatUtils';
import { useKeep } from '@/context/KeepContext';

interface SupportbenchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportbenchModal: React.FC<SupportbenchModalProps> = ({ isOpen, onClose }) => {
  const { addNote, categories } = useKeep();

  const [activeTab, setActiveTab] = useState<'download' | 'search' | 'credentials'>('download');

  // Credentials State
  const [baseUrl, setBaseUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [connectedUser, setConnectedUser] = useState<SupportbenchUser | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Download State
  const [casesInput, setCasesInput] = useState('');
  const [downloadAttachments, setDownloadAttachments] = useState(true);
  const [useRateLimitDelay, setUseRateLimitDelay] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Support');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SupportbenchCaseSummary[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());

  // Execution & Progress State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');
  const [delayCountdown, setDelayCountdown] = useState<number | null>(null);
  const [downloadLogs, setDownloadLogs] = useState<Array<{ id: string; success: boolean; text: string }>>([]);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const abortControllerRef = useRef<boolean>(false);

  // Load saved config on mount
  useEffect(() => {
    const saved = getSavedSupportbenchConfig();
    if (saved) {
      setBaseUrl(saved.baseUrl);
      setApiToken(saved.apiToken);
      testSupportbenchConnection(saved).then((res) => {
        if (res.success && res.user) {
          setConnectedUser(res.user);
        }
      });
    } else {
      setActiveTab('credentials');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentConfig: SupportbenchConfig = {
    baseUrl: baseUrl.trim() || 'https://api.supportbench.net',
    apiToken: apiToken.trim(),
  };

  const isConfigured = Boolean(apiToken.trim());

  const handleTestConnection = async () => {
    if (!apiToken.trim()) {
      setTestResult({ success: false, message: 'Please enter an API Token or API Key.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testSupportbenchConnection(currentConfig);
    setIsTesting(false);

    if (res.success) {
      setConnectedUser(res.user || { displayName: 'Supportbench User' });
      saveSupportbenchConfig(currentConfig);
      setTestResult({
        success: true,
        message: `Connected successfully! ${res.user?.displayName ? `(${res.user.displayName})` : ''}`,
      });
    } else {
      setConnectedUser(null);
      setTestResult({
        success: false,
        message: res.error || 'Connection failed. Please verify your domain and API token.',
      });
    }
  };

  const handleClearConfig = () => {
    clearSupportbenchConfig();
    setBaseUrl('');
    setApiToken('');
    setConnectedUser(null);
    setTestResult(null);
  };

  const handleSearchCases = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isConfigured) {
      setActiveTab('credentials');
      return;
    }

    setIsSearching(true);
    setDownloadError(null);
    try {
      const res = await searchSupportbenchCases(currentConfig, searchQuery, 25);
      setSearchResults(res.cases);
      setSelectedCaseIds(new Set());
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed searching Supportbench cases');
    } finally {
      setIsSearching(false);
    }
  };

  // Helper to add note to Keep
  const savePayloadAsNote = async (payload: SupportbenchNotePayload) => {
    const htmlContent = convertMarkdownToHtml(payload.markdown);
    await addNote({
      title: payload.title,
      content: htmlContent,
      category: selectedCategory || 'Support',
      labels: payload.labels,
      // Keep header images clean (only show inline where they belong)
      images: [],
    });
  };

  // Execute Batch Download with 15-second delay
  const handleStartDownload = async (identifiers: string[]) => {
    if (!isConfigured) {
      setActiveTab('credentials');
      return;
    }

    const cleanList = identifiers.map((s) => s.trim()).filter(Boolean);
    if (cleanList.length === 0) {
      setDownloadError('Please enter at least one Case Number, ID or URL.');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(`Preparing to download ${cleanList.length} cases...`);
    setDownloadSuccessMsg(null);
    setDownloadError(null);
    setDownloadLogs([]);
    abortControllerRef.current = false;

    let successfulCount = 0;
    let failedCount = 0;

    for (let i = 0; i < cleanList.length; i++) {
      if (abortControllerRef.current) {
        setDownloadLogs((prev) => [
          ...prev,
          { id: `cancel-${Date.now()}`, success: false, text: 'Download paused/cancelled by user.' },
        ]);
        break;
      }

      const rawIdentifier = cleanList[i];
      setDownloadProgress(`Downloading case ${i + 1} of ${cleanList.length}: ${rawIdentifier}...`);

      try {
        const payload = await fetchSupportbenchCase(currentConfig, rawIdentifier, downloadAttachments);
        await savePayloadAsNote(payload);
        successfulCount++;
        setDownloadLogs((prev) => [
          ...prev,
          {
            id: payload.caseId || `case-${i}`,
            success: true,
            text: `✓ [Case #${payload.caseNumber}] ${payload.title} - Created note with full history`,
          },
        ]);
      } catch (err: any) {
        failedCount++;
        setDownloadLogs((prev) => [
          ...prev,
          {
            id: `err-${i}`,
            success: false,
            text: `✕ Failed '${rawIdentifier}': ${err?.message || 'Error fetching case'}`,
          },
        ]);
      }

      // If more cases remain and rate limit delay is enabled, wait 15 seconds
      if (i < cleanList.length - 1 && useRateLimitDelay && !abortControllerRef.current) {
        for (let cd = 15; cd > 0; cd--) {
          if (abortControllerRef.current) break;
          setDelayCountdown(cd);
          setDownloadProgress(`Waiting ${cd}s before next case to respect rate limits (${i + 1}/${cleanList.length} done)...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setDelayCountdown(null);
      }
    }

    setIsDownloading(false);
    setDelayCountdown(null);
    setDownloadProgress('');

    if (successfulCount > 0) {
      setDownloadSuccessMsg(
        `Successfully downloaded and created ${successfulCount} note${successfulCount > 1 ? 's' : ''}!${
          failedCount > 0 ? ` (${failedCount} failed)` : ''
        }`
      );
    } else if (failedCount > 0) {
      setDownloadError(`Failed downloading ${failedCount} case${failedCount > 1 ? 's' : ''}. Check credentials and case numbers.`);
    }
  };

  const handleStopDownload = () => {
    abortControllerRef.current = true;
    setDelayCountdown(null);
    setDownloadProgress('Cancelling remaining downloads...');
  };

  // Toggle selection for search results
  const toggleSelectAllSearch = () => {
    if (selectedCaseIds.size === searchResults.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(searchResults.map((c) => c.caseNumber || c.id)));
    }
  };

  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-[#202124] w-full max-w-3xl rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-sm shadow-md">
              SB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                  Supportbench Integration
                </h2>
                {connectedUser ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Download cases, comments, activities &amp; local media attachments as Keep notes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-5 gap-2 bg-stone-50/30 dark:bg-stone-900/20 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'download'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Cases</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'search'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Search &amp; Browse</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'credentials'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Credentials &amp; API</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Global Alert Messages */}
          {downloadSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{downloadSuccessMsg}</span>
            </div>
          )}

          {downloadError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* TAB 1: DOWNLOAD CASES */}
          {activeTab === 'download' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Case Numbers, IDs, or Full URLs (Paste one per line):
                </label>
                <textarea
                  value={casesInput}
                  onChange={(e) => setCasesInput(e.target.value)}
                  disabled={isDownloading}
                  placeholder={`1042\n1043\nhttps://app.supportbench.net/cases/1044\n1045`}
                  rows={5}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1b1e] text-xs font-mono text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  💡 Tip: You can paste 20+ cases. Each case is downloaded with all comments and created as a separate Keep note.
                </p>
              </div>

              {/* Options */}
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                <label className="flex items-center gap-2 font-medium text-stone-800 dark:text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useRateLimitDelay}
                    onChange={(e) => setUseRateLimitDelay(e.target.checked)}
                    disabled={isDownloading}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>15-second delay between cases (prevents Supportbench rate limits &amp; IP throttling)</span>
                </label>

                <label className="flex items-center gap-2 font-medium text-stone-800 dark:text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadAttachments}
                    onChange={(e) => setDownloadAttachments(e.target.checked)}
                    disabled={isDownloading}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Download images &amp; file attachments locally to `local-media/` folder</span>
                </label>

                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2">
                  <span className="text-stone-500 dark:text-stone-400">Save to category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={isDownloading}
                    className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1b1e] text-xs text-stone-800 dark:text-stone-200"
                  >
                    <option value="">None</option>
                    <option value="Support">Support</option>
                    <option value="Work">Work</option>
                    {categories
                      .filter((c) => c.name !== 'Support' && c.name !== 'Work')
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Live Progress Bar & Countdown */}
              {isDownloading && (
                <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-teal-900 dark:text-teal-200">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      {downloadProgress}
                    </span>
                    {delayCountdown !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-teal-200 dark:bg-teal-800 text-[11px] font-mono">
                        Pause: {delayCountdown}s
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-teal-200 dark:bg-teal-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-teal-600 h-full w-full animate-pulse rounded-full" />
                  </div>
                </div>
              )}

              {/* Live Execution Logs */}
              {downloadLogs.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2.5 rounded-xl bg-stone-100 dark:bg-[#151618] border border-stone-200 dark:border-stone-800 text-[11px] font-mono">
                  {downloadLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`truncate ${
                        log.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {log.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('credentials')}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Configure API Token</span>
                </button>

                <div className="flex items-center gap-2">
                  {isDownloading ? (
                    <button
                      type="button"
                      onClick={handleStopDownload}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      Stop / Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartDownload(casesInput.split('\n'))}
                      disabled={!casesInput.trim()}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Cases into Keep</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEARCH & BROWSE */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchCases} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by case subject, customer, or keyword..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1b1e] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search</span>
                </button>
              </form>

              {/* Search Results Table */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-stone-50 dark:bg-stone-900/60 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-semibold text-stone-600 dark:text-stone-400">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAllSearch}
                      className="text-stone-500 hover:text-stone-700"
                    >
                      {selectedCaseIds.size > 0 && selectedCaseIds.size === searchResults.length ? (
                        <CheckSquare className="w-4 h-4 text-teal-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span>{searchResults.length} Cases Found</span>
                  </div>
                  {selectedCaseIds.size > 0 && (
                    <span className="text-teal-600 dark:text-teal-400">{selectedCaseIds.size} Selected</span>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                  {searchResults.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                      {isSearching ? 'Loading cases...' : 'No cases found. Click Search to fetch recent cases.'}
                    </div>
                  ) : (
                    searchResults.map((c) => {
                      const caseKey = c.caseNumber || c.id;
                      const isSelected = selectedCaseIds.has(caseKey);
                      return (
                        <div
                          key={c.id || c.caseNumber}
                          onClick={() => toggleSelectCase(caseKey)}
                          className={`p-3 flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 cursor-pointer text-xs transition-colors ${
                            isSelected ? 'bg-teal-50/60 dark:bg-teal-950/20' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectCase(caseKey);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-teal-600" />
                            ) : (
                              <Square className="w-4 h-4 text-stone-400" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-teal-700 dark:text-teal-400">#{c.caseNumber}</span>
                              <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                                {c.subject}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                              <span>Status: <b className="text-stone-700 dark:text-stone-300">{c.status}</b></span>
                              <span>Assignee: {c.assignee}</span>
                              {c.contact && <span>Customer: {c.contact}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action for selected search items */}
              {selectedCaseIds.size > 0 && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleStartDownload(Array.from(selectedCaseIds))}
                    disabled={isDownloading}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {selectedCaseIds.size} Selected Cases</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREDENTIALS & API */}
          {activeTab === 'credentials' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-950 dark:text-teal-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Supportbench REST API Credentials
                </p>
                <p className="text-[11px] text-stone-600 dark:text-stone-400">
                  Provide your Supportbench Base URL / Subdomain and Bearer API Token or API Key. Tokens are stored securely in your browser's localStorage.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Base URL or Subdomain:
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://<your-subdomain>.supportbench.com or https://api.supportbench.net"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1b1e] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  Enter your instance URL (e.g. <code>https://company.supportbench.com</code> or <code>https://api.supportbench.net</code>). All API requests are sent directly to this address.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  API Token / API Key:
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Paste your Supportbench Bearer Token or API Key"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1b1e] text-xs font-mono text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="text-xs text-stone-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Saved Credentials</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !apiToken.trim()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>Test &amp; Save Connection</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
