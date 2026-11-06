import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Lock,
  Key,
  ShieldCheck,
  Clipboard,
  ExternalLink,
  Download,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Tag,
  Settings2,
  Sparkles,
  X,
  Layers,
  Clock,
  StopCircle,
  ListPlus,
  Play,
  Upload,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { convertMarkdownToHtml } from '@/lib/formatUtils';
import { parseMhtmlFile } from '@/lib/mhtmlParser';
import {
  UrlAuthType,
  extractFromUrl,
  getDomainAuth,
  saveDomainAuth,
  deleteDomainAuth,
  ExtractUrlResult,
} from '@/lib/urlExtractor';

interface ExtractUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (result: ExtractUrlResult, insertMode?: boolean) => void;
  initialUrl?: string;
  isInsertMode?: boolean; // If opened from an existing note editor
}

export const ExtractUrlModal: React.FC<ExtractUrlModalProps> = ({
  isOpen,
  onClose,
  onExtracted,
  initialUrl = '',
  isInsertMode = false,
}) => {
  const { addNote, selectedCategory, importDataSmart } = useKeep();

  const [extractionMode, setExtractionMode] = useState<'single' | 'file' | 'batch'>('single');
  const [url, setUrl] = useState(initialUrl);

  // File Upload State
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [fileUploadSuccess, setFileUploadSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWebpageFile = async (file: File) => {
    if (!file) return;
    setIsUploadingFile(true);
    setFileUploadError(null);
    setFileUploadSuccess(null);

    try {
      if (isInsertMode) {
        const parsed = await parseMhtmlFile(file);
        onExtracted(
          {
            success: true,
            title: parsed.title,
            markdown: parsed.markdownContent,
            sourceUrl: parsed.sourceUrl || '',
            images: [],
          },
          true
        );
        onClose();
        return;
      }

      const res = await importDataSmart(file);
      if (res.success) {
        setFileUploadSuccess(`Imported "${file.name}" as a note!`);
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        setFileUploadError(res.message || 'Failed to import webpage file.');
      }
    } catch (err: any) {
      setFileUploadError(err?.message || 'Error processing webpage file.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Multi-URL Batch Scraping State
  const [batchUrlsText, setBatchUrlsText] = useState('');
  const [batchDelaySeconds, setBatchDelaySeconds] = useState(15);
  const [batchItems, setBatchItems] = useState<
    Array<{
      url: string;
      status: 'pending' | 'scraping' | 'waiting' | 'done' | 'error';
      title?: string;
      error?: string;
    }>
  >([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    countdown: number;
    active: boolean;
    completed: boolean;
    successCount: number;
    failCount: number;
  }>({
    current: 0,
    total: 0,
    countdown: 0,
    active: false,
    completed: false,
    successCount: 0,
    failCount: 0,
  });

  const cancelBatchRef = useRef<boolean>(false);

  const [authType, setAuthType] = useState<UrlAuthType>('none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [cookie, setCookie] = useState('');
  const [customHeadersJson, setCustomHeadersJson] = useState('');
  const [rememberAuth, setRememberAuth] = useState(true);
  const [downloadImages, setDownloadImages] = useState(true);
  const [imagePathStyle, setImagePathStyle] = useState<'relative' | 'api' | 'filename'>('relative');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<ExtractUrlResult | null>(null);

  const parsedBatchUrls = batchUrlsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

  // Detect domain & auto-fill saved credentials
  useEffect(() => {
    if (!url.trim()) {
      setHasSavedCreds(false);
      return;
    }

    try {
      const parsed = new URL(url.trim());
      const domain = parsed.hostname;
      const isJira = domain.includes('atlassian.net') || parsed.pathname.includes('/browse/');

      const saved = getDomainAuth(domain);
      if (saved) {
        setHasSavedCreds(true);
        setAuthType(saved.authType);
        if (saved.username) setUsername(saved.username);
        if (saved.password) setPassword(saved.password);
        if (saved.token) setToken(saved.token);
        if (saved.cookie) setCookie(saved.cookie);
        if (saved.customHeaders) {
          setCustomHeadersJson(JSON.stringify(saved.customHeaders, null, 2));
        }
      } else {
        setHasSavedCreds(false);
        if (isJira && authType === 'none') {
          setAuthType('jira');
        }
      }
    } catch {
      setHasSavedCreds(false);
    }
  }, [url]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setUrl(text.trim());
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleClearSavedAuth = () => {
    try {
      const parsed = new URL(url.trim());
      deleteDomainAuth(parsed.hostname);
      setHasSavedCreds(false);
      setUsername('');
      setPassword('');
      setToken('');
      setCookie('');
      setAuthType('none');
    } catch {
      // Ignore
    }
  };

  const handlePasteBatchClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setBatchUrlsText((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleStopBatch = () => {
    cancelBatchRef.current = true;
    setStatusMessage('Stopping batch scraping after current request completes...');
  };

  const handleStartBatch = async () => {
    if (parsedBatchUrls.length === 0) {
      setError('Please enter at least one valid URL in the text area.');
      return;
    }

    setError(null);
    cancelBatchRef.current = false;

    const initialItems = parsedBatchUrls.map((u) => ({
      url: u,
      status: 'pending' as const,
    }));
    setBatchItems(initialItems);

    setBatchProgress({
      current: 0,
      total: parsedBatchUrls.length,
      countdown: 0,
      active: true,
      completed: false,
      successCount: 0,
      failCount: 0,
    });

    let customHeaders: Record<string, string> | undefined = undefined;
    if (authType === 'custom' && customHeadersJson.trim()) {
      try {
        customHeaders = JSON.parse(customHeadersJson.trim());
      } catch {
        // ignore
      }
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < parsedBatchUrls.length; i++) {
      if (cancelBatchRef.current) break;

      const currentUrl = parsedBatchUrls[i];

      // Update current item status to scraping
      setBatchItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'scraping' } : item))
      );
      setBatchProgress((prev) => ({ ...prev, current: i + 1, countdown: 0 }));

      // Resolve auth for this specific URL if domain has saved auth
      let currentAuthType = authType;
      let currentUsername = username;
      let currentPassword = password;
      let currentToken = token;
      let currentCookie = cookie;
      let currentHeaders = customHeaders;

      try {
        const uParsed = new URL(currentUrl);
        const domain = uParsed.hostname;
        const saved = getDomainAuth(domain);
        if (saved && authType === 'none') {
          currentAuthType = saved.authType;
          if (saved.username) currentUsername = saved.username;
          if (saved.password) currentPassword = saved.password;
          if (saved.token) currentToken = saved.token;
          if (saved.cookie) currentCookie = saved.cookie;
          if (saved.customHeaders) currentHeaders = saved.customHeaders;
        }
      } catch {
        // Ignore URL parse error
      }

      try {
        const result = await extractFromUrl({
          url: currentUrl,
          authType: currentAuthType,
          username: currentUsername.trim() || undefined,
          password: currentPassword.trim() || undefined,
          token: currentToken.trim() || undefined,
          cookie: currentCookie.trim() || undefined,
          customHeaders: currentHeaders,
          downloadImages,
          imagePathStyle,
        });

        const htmlContent = convertMarkdownToHtml(result.markdown);
        const imagePaths = (result.images || []).map((img) => img.savedPath || img.serveUrl);
        const newLabels = Array.from(new Set([...(result.labels || []), 'clipped']));

        // Automatically create individual note for this URL!
        await addNote({
          id: `note-url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: result.title || `Extracted Note (${i + 1})`,
          content: htmlContent,
          isList: false,
          todos: [],
          color: 'default',
          theme: 'none',
          category: selectedCategory || (result.isJira ? 'Work' : null),
          labels: newLabels,
          isPinned: false,
          images: [], // Images are already embedded inline in content
          drawings: [],
        });

        success++;
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', title: result.title } : item
          )
        );
        setBatchProgress((prev) => ({ ...prev, successCount: success }));
      } catch (err: any) {
        failed++;
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: err?.message || 'Extraction failed' } : item
          )
        );
        setBatchProgress((prev) => ({ ...prev, failCount: failed }));
      }

      // If more URLs remain and not cancelled, wait the specified delay (default 15 seconds)
      if (i < parsedBatchUrls.length - 1 && !cancelBatchRef.current) {
        setBatchItems((prev) =>
          prev.map((item, idx) => (idx === i + 1 ? { ...item, status: 'waiting' } : item))
        );

        for (let s = batchDelaySeconds; s > 0; s--) {
          if (cancelBatchRef.current) break;
          setBatchProgress((prev) => ({ ...prev, countdown: s }));
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      active: false,
      completed: true,
      countdown: 0,
    }));
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Please enter a valid webpage or Jira URL.');
      return;
    }

    setError(null);
    setLoading(true);
    setStatusMessage('Connecting to webpage...');
    setExtractedPreview(null);

    let customHeaders: Record<string, string> | undefined = undefined;
    if (authType === 'custom' && customHeadersJson.trim()) {
      try {
        customHeaders = JSON.parse(customHeadersJson.trim());
      } catch {
        setError('Invalid JSON format in Custom Headers.');
        setLoading(false);
        return;
      }
    }

    try {
      const parsed = new URL(url.trim());
      const domain = parsed.hostname;

      // Save domain auth if requested
      if (rememberAuth && authType !== 'none') {
        saveDomainAuth({
          domain,
          authType,
          username: username.trim() || undefined,
          password: password.trim() || undefined,
          token: token.trim() || undefined,
          cookie: cookie.trim() || undefined,
          customHeaders,
        });
      }

      setStatusMessage(authType === 'jira' ? 'Authenticating with Jira API...' : 'Fetching content & downloading images...');

      const result = await extractFromUrl({
        url: url.trim(),
        authType,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        token: token.trim() || undefined,
        cookie: cookie.trim() || undefined,
        customHeaders,
        downloadImages,
        imagePathStyle,
      });

      setStatusMessage('Content extracted successfully!');
      setExtractedPreview(result);
    } catch (err: any) {
      console.error('Extract error:', err);
      setError(err?.message || 'Failed to extract content from URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmApply = () => {
    if (!extractedPreview) return;
    onExtracted(extractedPreview, isInsertMode);
    onClose();
  };

  const parsedDomain = (() => {
    try {
      return new URL(url.trim()).hostname;
    } catch {
      return null;
    }
  })();

  const isJiraDomain = parsedDomain ? parsedDomain.includes('atlassian.net') || url.includes('/browse/') : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-stone-50 dark:bg-stone-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Import from Webpage
                {isJiraDomain && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                    Jira Supported
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Clip any webpage or Jira ticket from URL, or upload saved webpage files (.html, .htm, .mhtml)
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

        {/* Mode Tabs */}
        <div className="flex items-center px-5 pt-2.5 border-b border-black/10 dark:border-white/10 bg-stone-50/70 dark:bg-stone-850/70 gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setExtractionMode('single')}
            disabled={batchProgress.active}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              extractionMode === 'single'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Webpage URL
          </button>
          <button
            type="button"
            onClick={() => setExtractionMode('file')}
            disabled={batchProgress.active}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              extractionMode === 'file'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Webpage File (.html / .mhtml)
          </button>
          <button
            type="button"
            onClick={() => setExtractionMode('batch')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              extractionMode === 'batch'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Multi URLs Scraping
            {parsedBatchUrls.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-2xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono font-bold">
                {parsedBatchUrls.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Mode: Webpage File Upload */}
          {extractionMode === 'file' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Upload Saved Webpage Document
                </label>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Import webpages saved from Chrome, Edge, Safari, or Firefox. Supports <strong>.html</strong>, <strong>.htm</strong>, and <strong>.mhtml</strong> / <strong>.mht</strong> files with embedded text, styles, and inline images.
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleWebpageFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                      : 'border-stone-300 dark:border-stone-700 hover:border-blue-400 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Drop your webpage file here, or <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Supports .html, .htm, .mhtml, .mht web archives
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.mhtml,.mht,text/html,multipart/related,message/rfc822"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleWebpageFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {isUploadingFile && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-2.5 text-xs text-blue-700 dark:text-blue-300">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Processing webpage snapshot, cleaning clutter and converting to note...</span>
                </div>
              )}

              {fileUploadSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{fileUploadSuccess}</span>
                </div>
              )}

              {fileUploadError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fileUploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 1: Single URL Input */}
          {extractionMode === 'single' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                Webpage or Ticket URL
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="https://company.atlassian.net/browse/PROJ-123 or https://example.com/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading && url.trim()) {
                        handleExtract();
                      }
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-xs sm:text-sm"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-3 py-2.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
              </div>

              {/* Saved Credentials Hint */}
              {hasSavedCreds && parsedDomain && (
                <div className="flex items-center justify-between mt-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Using saved credentials for <strong>{parsedDomain}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSavedAuth}
                    className="text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Forget saved credentials for this domain"
                  >
                    <Trash2 className="w-3 h-3" />
                    Forget
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Multi URLs Scraping Input */}
          {extractionMode === 'batch' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4 text-blue-500" />
                    URLs to Scrape (one per line, 20+ URLs supported)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 font-mono text-stone-600 dark:text-stone-400 font-semibold">
                      {parsedBatchUrls.length} URL{parsedBatchUrls.length === 1 ? '' : 's'} detected
                    </span>
                    <button
                      type="button"
                      onClick={handlePasteBatchClipboard}
                      disabled={batchProgress.active}
                      className="text-2xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Clipboard className="w-3 h-3" /> Paste
                    </button>
                    {batchUrlsText && !batchProgress.active && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchUrlsText('');
                          setBatchItems([]);
                          setBatchProgress((prev) => ({ ...prev, active: false, completed: false }));
                        }}
                        className="text-2xs text-stone-400 hover:text-red-500 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={batchUrlsText}
                  onChange={(e) => setBatchUrlsText(e.target.value)}
                  disabled={batchProgress.active}
                  placeholder={`https://company.atlassian.net/browse/CA-101\nhttps://company.atlassian.net/browse/CA-102\nhttps://company.atlassian.net/browse/CA-103\nhttps://example.com/article...`}
                  className="w-full p-3 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
                />
                <p className="text-2xs text-stone-500 dark:text-stone-400 mt-1">
                  Each URL will automatically create an individual note with its title, markdown content, comments, and media.
                </p>
              </div>

              {/* Delay Configuration */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      Delay between each scrape:
                    </span>
                    <p className="text-2xs text-stone-500 dark:text-stone-400">
                      Default 15 seconds pause between requests to prevent Jira API rate limits & blocks
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={batchDelaySeconds}
                    onChange={(e) => setBatchDelaySeconds(Math.max(1, parseInt(e.target.value, 10) || 15))}
                    disabled={batchProgress.active}
                    className="w-16 px-2.5 py-1 text-center text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                  />
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-400">seconds</span>
                </div>
              </div>

              {/* Batch Scraping Progress Card */}
              {batchItems.length > 0 && (
                <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-850/40 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
                      {batchProgress.active ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : batchProgress.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Layers className="w-4 h-4 text-stone-400" />
                      )}
                      Progress: {batchProgress.current} / {batchProgress.total} processed
                    </span>
                    <span className="font-mono text-2xs text-stone-500 dark:text-stone-400">
                      <strong className="text-emerald-600 dark:text-emerald-400">{batchProgress.successCount}</strong> notes created · <strong className="text-red-500">{batchProgress.failCount}</strong> failed
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{
                        width: `${(batchProgress.current / Math.max(batchProgress.total, 1)) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Live Countdown Banner */}
                  {batchProgress.countdown > 0 && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between animate-pulse">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        Pausing <strong>{batchProgress.countdown}s</strong> before scraping next URL to avoid rate limiting...
                      </span>
                      <span className="text-xs font-mono font-black bg-amber-200 dark:bg-amber-900/80 px-2 py-0.5 rounded-md text-amber-900 dark:text-amber-200">
                        {batchProgress.countdown}s
                      </span>
                    </div>
                  )}

                  {/* URL Items Status List */}
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-stone-100 dark:divide-stone-800">
                    {batchItems.map((item, idx) => (
                      <div key={idx} className="pt-1.5 flex items-center justify-between gap-2 text-2xs font-mono">
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <span className="text-stone-400 shrink-0">#{idx + 1}</span>
                          <span className="truncate text-stone-700 dark:text-stone-300" title={item.url}>
                            {item.url}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {item.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                              Queued
                            </span>
                          )}
                          {item.status === 'scraping' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1 font-semibold">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Scraping...
                            </span>
                          )}
                          {item.status === 'waiting' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                              Waiting...
                            </span>
                          )}
                          {item.status === 'done' && (
                            <span
                              className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 truncate max-w-[200px]"
                              title={item.title}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{item.title || 'Note Created'}</span>
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span
                              className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold truncate max-w-[180px]"
                              title={item.error}
                            >
                              Error: {item.error || 'Failed'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Authentication Selector */}
          <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-500" />
                Authentication / Permissions
              </span>
              <span className="text-2xs text-stone-400">
                Required for private Jira, Confluence, or internal portals
              </span>
            </div>

            {/* Auth Type Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { type: 'none' as UrlAuthType, label: 'Public (No Auth)', icon: Globe },
                { type: 'jira' as UrlAuthType, label: 'Jira / Atlassian', icon: ShieldCheck },
                { type: 'bearer' as UrlAuthType, label: 'Bearer Token', icon: Key },
                { type: 'basic' as UrlAuthType, label: 'Basic Auth', icon: Lock },
                { type: 'cookie' as UrlAuthType, label: 'Cookie / Session', icon: ExternalLink },
                { type: 'custom' as UrlAuthType, label: 'Custom Headers', icon: Settings2 },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = authType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setAuthType(item.type)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Auth Fields */}
            {authType === 'jira' && (
              <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-800">
                <div>
                  <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Atlassian Account Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-2xs font-semibold text-stone-600 dark:text-stone-400">
                      Jira API Token (or password for Jira Server)
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
                    placeholder="Enter Atlassian API Token..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
            )}

            {authType === 'basic' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200 dark:border-stone-800">
                <div>
                  <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Username / Login
                  </label>
                  <input
                    type="text"
                    placeholder="admin or user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                    Password / Token
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {authType === 'bearer' && (
              <div className="pt-1 border-t border-stone-200 dark:border-stone-800">
                <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Bearer Token / Personal Access Token
                </label>
                <input
                  type="password"
                  placeholder="ghp_... or eyJhbGciOi..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            )}

            {authType === 'cookie' && (
              <div className="pt-1 border-t border-stone-200 dark:border-stone-800">
                <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Session Cookie string
                </label>
                <input
                  type="password"
                  placeholder="JSESSIONID=abc123xyz; cloud.session=..."
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            )}

            {authType === 'custom' && (
              <div className="pt-1 border-t border-stone-200 dark:border-stone-800">
                <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  Custom Request Headers (JSON)
                </label>
                <textarea
                  rows={3}
                  placeholder={`{\n  "X-Custom-Auth": "secret",\n  "X-Atlassian-Token": "no-check"\n}`}
                  value={customHeadersJson}
                  onChange={(e) => setCustomHeadersJson(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            )}

            {/* Remember Auth Checkbox */}
            {authType !== 'none' && parsedDomain && (
              <label className="flex items-center gap-2 pt-1 text-xs text-stone-600 dark:text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberAuth}
                  onChange={(e) => setRememberAuth(e.target.checked)}
                  className="w-3.5 h-3.5 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                />
                Remember credentials for <strong>{parsedDomain}</strong>
              </label>
            )}
          </div>

          {/* Advanced Image & Storage Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 flex items-center gap-1 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Image & Media Storage Options
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 space-y-2.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadImages}
                    onChange={(e) => setDownloadImages(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-stone-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      Download images to local folder
                    </span>
                    <p className="text-2xs text-stone-500 dark:text-stone-400">
                      Fetches images with authentication headers and stores them permanently in your local-media folder
                    </p>
                  </div>
                </label>

                {downloadImages && (
                  <div>
                    <label className="block text-2xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Markdown Image Link Format
                    </label>
                    <select
                      value={imagePathStyle}
                      onChange={(e) => setImagePathStyle(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    >
                      <option value="relative">Relative Path (local-media/image.png) - Recommended for Obsidian & Keep</option>
                      <option value="filename">File Name Only (image.png)</option>
                      <option value="api">Local Media API URL (/api/local-media?...)</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Extraction Error:</span> {error}
              </div>
            </div>
          )}

          {/* Success / Preview Panel */}
          {extractedPreview && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Ready to Import
                </span>
                <span className="text-2xs text-emerald-700 dark:text-emerald-400 font-mono">
                  {extractedPreview.images.length} images downloaded
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                  {extractedPreview.title}
                </h4>
                <p className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Source: {extractedPreview.sourceUrl}
                </p>
              </div>

              {/* Preview Markdown Snippet */}
              <div className="max-h-32 overflow-y-auto p-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-2xs font-mono text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                {extractedPreview.markdown.slice(0, 500)}
                {extractedPreview.markdown.length > 500 ? '...' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/10 dark:border-white/10 bg-stone-50 dark:bg-stone-850">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {extractionMode === 'single' ? (
              loading ? (
                <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {statusMessage}
                </span>
              ) : extractedPreview ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Preview ready
                </span>
              ) : (
                <span>Supports Jira, Confluence, GitHub & any web page</span>
              )
            ) : batchProgress.active ? (
              <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scraping URL {batchProgress.current} of {batchProgress.total}...
              </span>
            ) : batchProgress.completed ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed: Created {batchProgress.successCount} note{batchProgress.successCount === 1 ? '' : 's'}
                {batchProgress.failCount > 0 ? ` (${batchProgress.failCount} failed)` : ''}!
              </span>
            ) : (
              <span>
                {parsedBatchUrls.length > 0
                  ? `${parsedBatchUrls.length} note${parsedBatchUrls.length === 1 ? '' : 's'} will be created with ${batchDelaySeconds}s delay`
                  : 'Enter URLs above to start batch scraping'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || batchProgress.active}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-750 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {batchProgress.completed ? 'Close' : 'Cancel'}
            </button>

            {extractionMode === 'single' ? (
              extractedPreview ? (
                <button
                  type="button"
                  onClick={handleConfirmApply}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isInsertMode ? 'Insert into Note' : 'Create Note'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={loading || !url.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Extract Content
                    </>
                  )}
                </button>
              )
            ) : batchProgress.active ? (
              <button
                type="button"
                onClick={handleStopBatch}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <StopCircle className="w-4 h-4" />
                Stop Scraping
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBatch}
                disabled={parsedBatchUrls.length === 0}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Scraping ({parsedBatchUrls.length} Notes)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
