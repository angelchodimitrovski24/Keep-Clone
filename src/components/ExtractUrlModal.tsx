import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
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
  const [url, setUrl] = useState(initialUrl);
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
                Extract from URL
                {isJiraDomain && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                    Jira Supported
                  </span>
                )}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Extract webpage or Jira tickets (including up to 100 comments, subtasks &amp; local attachments) as Markdown
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* URL Input */}
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
                className="px-3 py-2.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors flex items-center gap-1.5 shrink-0"
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
                  className="text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  title="Forget saved credentials for this domain"
                >
                  <Trash2 className="w-3 h-3" />
                  Forget
                </button>
              </div>
            )}
          </div>

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
            {loading ? (
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
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-750 transition-colors"
            >
              Cancel
            </button>

            {extractedPreview ? (
              <button
                type="button"
                onClick={handleConfirmApply}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isInsertMode ? 'Insert into Note' : 'Create Note'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExtract}
                disabled={loading || !url.trim()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
