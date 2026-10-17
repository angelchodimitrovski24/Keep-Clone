'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  ExternalLink,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Key,
  HelpCircle,
  FileArchive,
  Loader2,
  LogOut,
  FolderCheck,
  HardDrive,
  Info,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { generateBackupZipBlob } from '@/lib/backupZip';
import {
  getStoredDriveAuth,
  getStoredClientId,
  saveStoredClientId,
  requestDriveAccessToken,
  disconnectGoogleDrive,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  downloadGoogleDriveBackup,
  deleteGoogleDriveBackup,
  formatBytes,
  GoogleDriveAuthState,
  GoogleDriveFile,
} from '@/lib/googleDrive';

export const GoogleDriveModal: React.FC = () => {
  const {
    isGoogleDriveModalOpen,
    setIsGoogleDriveModalOpen,
    importDataSmart,
    notes,
  } = useKeep();

  const [authState, setAuthState] = useState<GoogleDriveAuthState>(() => getStoredDriveAuth());
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [backups, setBackups] = useState<GoogleDriveFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load backups when authenticated
  const loadBackups = useCallback(async (token: string) => {
    setIsLoadingBackups(true);
    try {
      const files = await listGoogleDriveBackups(token);
      setBackups(files);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to list Google Drive backups.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsLoadingBackups(false);
    }
  }, []);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isGoogleDriveModalOpen) {
      const currentAuth = getStoredDriveAuth();
      setAuthState(currentAuth);
      setClientIdInput(currentAuth.clientId || getStoredClientId());
      setFeedback(null);

      if (currentAuth.isConnected && currentAuth.accessToken) {
        loadBackups(currentAuth.accessToken);
      }
    }
  }, [isGoogleDriveModalOpen, loadBackups]);

  if (!isGoogleDriveModalOpen) return null;

  // Handle Google Drive Connect
  const handleConnect = async () => {
    const targetClientId = clientIdInput.trim() || getStoredClientId();
    if (!targetClientId) {
      setFeedback({
        type: 'error',
        message: 'Please enter a Google OAuth 2.0 Web Client ID to connect.',
      });
      setShowConfigHelp(true);
      return;
    }

    setIsConnecting(true);
    setFeedback(null);

    try {
      saveStoredClientId(targetClientId);
      const res = await requestDriveAccessToken(targetClientId);
      const newAuth: GoogleDriveAuthState = {
        isConnected: true,
        accessToken: res.accessToken,
        expiresAt: res.expiresAt,
        user: res.user,
        clientId: targetClientId,
      };
      setAuthState(newAuth);
      setFeedback({
        type: 'success',
        message: `Successfully connected to Google Drive${res.user?.email ? ` as ${res.user.email}` : ''}!`,
      });
      await loadBackups(res.accessToken);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Google authentication failed.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setAuthState({
      isConnected: false,
      accessToken: null,
      expiresAt: null,
      user: null,
      clientId: getStoredClientId(),
    });
    setBackups([]);
    setFeedback({ type: 'info', message: 'Disconnected from Google Drive.' });
  };

  // Handle Export to Google Drive
  const handleExportToDrive = async () => {
    if (!authState.accessToken) {
      setFeedback({ type: 'error', message: 'You must connect to Google Drive first.' });
      return;
    }

    setIsExporting(true);
    setFeedback(null);

    try {
      // 1. Generate full ZIP bundle
      const { blob, filename, notesCount, mediaCount } = await generateBackupZipBlob();

      // 2. Upload to Google Drive "Google Keep Backups" folder
      const uploadedFile = await uploadBackupToGoogleDrive(authState.accessToken, blob, filename);

      setFeedback({
        type: 'success',
        message: `Export complete! Saved "${uploadedFile.name}" (${notesCount} notes, ${mediaCount} media files) to your "Google Keep Backups" folder.`,
      });

      // 3. Refresh file list
      await loadBackups(authState.accessToken);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Export to Google Drive failed.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Smart Import from Drive
  const handleImportFromDrive = async (file: GoogleDriveFile) => {
    if (!authState.accessToken) return;

    setImportingId(file.id);
    setFeedback(null);

    try {
      // 1. Download file blob from Google Drive as File
      const downloadedFile = await downloadGoogleDriveBackup(
        authState.accessToken,
        file.id,
        file.name
      );

      // 2. Close this modal so the ImportSummaryModal can be displayed smoothly
      setIsGoogleDriveModalOpen(false);

      // 3. Run the intelligent reconciliation import pipeline
      await importDataSmart(downloadedFile);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import backup from Google Drive.';
      setFeedback({ type: 'error', message: errorMsg });
      setImportingId(null);
    }
  };

  // Handle Delete from Drive
  const handleDeleteBackup = async (fileId: string, fileName: string) => {
    if (!authState.accessToken) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${fileName}" from Google Drive?`)) {
      return;
    }

    setDeletingId(fileId);
    setFeedback(null);

    try {
      await deleteGoogleDriveBackup(authState.accessToken, fileId);
      setBackups((prev) => prev.filter((b) => b.id !== fileId));
      setFeedback({
        type: 'success',
        message: `Deleted "${fileName}" from Google Drive.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete backup from Google Drive.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      onClick={() => setIsGoogleDriveModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 flex flex-col overflow-hidden max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-linear-to-r from-blue-50/50 to-emerald-50/30 dark:from-blue-950/20 dark:to-emerald-950/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-stone-900 dark:text-stone-100">
                  Google Drive Cloud Backup
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  Direct Sync
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Securely export and restore intelligent ZIP archives with Google Drive
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsGoogleDriveModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status / Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : feedback.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              ) : (
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              )}
              <div className="flex-1 font-medium">{feedback.message}</div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section: Authentication Status */}
          <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50">
            {authState.isConnected ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {authState.user?.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={authState.user.picture}
                      alt={authState.user.name || 'User'}
                      className="w-10 h-10 rounded-full border border-emerald-500 ring-2 ring-emerald-500/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      {authState.user?.name ? authState.user.name[0].toUpperCase() : 'G'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                        {authState.user?.name || 'Connected to Google Drive'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {authState.user?.email || 'Authorized via Google Identity Services'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-500" />
                      Google Cloud OAuth 2.0 Setup
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Enter your Google OAuth Client ID to connect your Google Drive.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfigHelp(!showConfigHelp)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showConfigHelp ? 'Hide instructions' : 'How to get Client ID'}</span>
                  </button>
                </div>

                {/* Collapsible Help Guide */}
                {showConfigHelp && (
                  <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-2 leading-relaxed animate-in fade-in">
                    <p className="font-semibold">Quick 2-minute Setup Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 pl-1">
                      <li>
                        Go to the{' '}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold underline inline-flex items-center gap-0.5 hover:text-blue-700"
                        >
                          Google Cloud Credentials Console <ExternalLink className="w-3 h-3 inline" />
                        </a>.
                      </li>
                      <li>Click <b>Create Credentials</b> &rarr; <b>OAuth client ID</b>.</li>
                      <li>Select Application type: <b>Web application</b>.</li>
                      <li>
                        Under <b>Authorized JavaScript origins</b>, add your current URL:
                        <code className="ml-1 px-1.5 py-0.5 bg-white/70 dark:bg-black/30 rounded font-mono text-[11px]">
                          {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
                        </code>
                      </li>
                      <li>Copy the generated <b>Client ID</b> and paste it in the box below.</li>
                    </ol>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 123456789-xxxxxxxxxxxx.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-xs shrink-0"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Sign In with Google</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: One-Click Export to Drive */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-blue-500" />
                Upload New Backup to Google Drive
              </label>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {notes.length} notes ready
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Bundles all your local notes, images, drawings, and markdown files into a single timestamped ZIP archive and saves it to your private <b>&quot;Google Keep Backups&quot;</b> folder in Google Drive.
            </p>

            <button
              type="button"
              onClick={handleExportToDrive}
              disabled={!authState.isConnected || isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md transition-all"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Packaging &amp; Uploading to Google Drive...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>Export Current Notes to Google Drive</span>
                </>
              )}
            </button>
          </div>

          <hr className="border-stone-200 dark:border-stone-800" />

          {/* Section: Backups on Google Drive */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Backups on Google Drive
                </h4>
              </div>

              {authState.isConnected && (
                <button
                  type="button"
                  onClick={() => authState.accessToken && loadBackups(authState.accessToken)}
                  disabled={isLoadingBackups}
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium transition-colors"
                  title="Refresh list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Select any cloud backup to intelligently restore. Changed and new items will be merged without duplicating your existing notes.
            </p>

            {!authState.isConnected ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-400 text-xs">
                Connect your Google Drive above to view, download, or restore your cloud backups.
              </div>
            ) : isLoadingBackups ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-stone-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span>Searching Google Drive for backups...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-xs space-y-1">
                <FolderCheck className="w-8 h-8 text-stone-400 mx-auto mb-1 stroke-1" />
                <p className="font-medium text-stone-700 dark:text-stone-300">No backups found on Google Drive yet.</p>
                <p className="text-[11px] text-stone-400">
                  Click &quot;Export Current Notes to Google Drive&quot; above to create your first cloud backup.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden max-h-60 overflow-y-auto">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 bg-white dark:bg-[#202124] hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileArchive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-stone-800 dark:text-stone-200 truncate" title={b.name}>
                          {b.name}
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                          <span>{formatBytes(b.size)}</span>
                          <span>&bull;</span>
                          <span>{b.modifiedTime ? new Date(b.modifiedTime).toLocaleString() : 'Unknown date'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Open in Google Drive */}
                      {b.webViewLink && (
                        <a
                          href={b.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                          title="Open file in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Delete Backup */}
                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(b.id, b.name)}
                        disabled={deletingId === b.id}
                        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete from Google Drive"
                      >
                        {deletingId === b.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Smart Import Button */}
                      <button
                        type="button"
                        onClick={() => handleImportFromDrive(b)}
                        disabled={importingId === b.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-xs"
                        title="Intelligently import this backup without duplicate notes"
                      >
                        {importingId === b.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <CloudDownload className="w-3.5 h-3.5" />
                            <span>Import</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Privacy-friendly: Only accesses the dedicated app folder on your Drive.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsGoogleDriveModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold text-xs hover:opacity-90 transition-opacity shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
