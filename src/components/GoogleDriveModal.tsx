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
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  Check,
  HardDrive,
  Info,
  CornerLeftUp,
  FolderCheck,
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
  listGoogleDriveFolders,
  createGoogleDriveFolder,
  ensureKeepBackupsFolder,
  formatBytes,
  GoogleDriveAuthState,
  GoogleDriveFile,
  GoogleDriveFolder,
} from '@/lib/googleDrive';

const STORAGE_KEY_EXPORT_FOLDER = 'keep_gdrive_export_folder';

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

  // Folder navigation & contents state
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string }>({
    id: 'root',
    name: 'My Drive',
  });
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [selectedExportFolder, setSelectedExportFolder] = useState<{ id: string; name: string }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_EXPORT_FOLDER);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { id: 'root', name: 'Google Keep Backups' };
  });

  const [subfolders, setSubfolders] = useState<GoogleDriveFolder[]>([]);
  const [backups, setBackups] = useState<GoogleDriveFile[]>([]);
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [isSearchingAllDrive, setIsSearchingAllDrive] = useState(false);

  // Create folder dialog state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Save export folder preference
  const saveExportFolder = (folder: { id: string; name: string }) => {
    setSelectedExportFolder(folder);
    try {
      localStorage.setItem(STORAGE_KEY_EXPORT_FOLDER, JSON.stringify(folder));
    } catch {}
    setFeedback({
      type: 'info',
      message: `Set "${folder.name}" as destination folder for exports.`,
    });
  };

  // Load contents of a folder (both subfolders and backup files)
  const loadFolderContents = useCallback(
    async (token: string, folderId: string, searchAll = false) => {
      setIsLoadingContents(true);
      setFeedback(null);
      try {
        // Fetch subfolders if not searching all
        if (!searchAll) {
          const folderList = await listGoogleDriveFolders(token, folderId);
          setSubfolders(folderList);
        } else {
          setSubfolders([]);
        }

        // Fetch backup files in this folder (or all)
        const fileList = await listGoogleDriveBackups(token, searchAll ? 'all' : folderId);
        setBackups(fileList);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load Google Drive folder contents.';
        setFeedback({ type: 'error', message: errorMsg });
      } finally {
        setIsLoadingContents(false);
      }
    },
    []
  );

  // Initial load when modal opens
  useEffect(() => {
    if (isGoogleDriveModalOpen) {
      const currentAuth = getStoredDriveAuth();
      setAuthState(currentAuth);
      setClientIdInput(currentAuth.clientId || getStoredClientId());
      setFeedback(null);

      if (currentAuth.isConnected && currentAuth.accessToken) {
        // If we have a saved export folder that isn't 'root', locate or check it
        ensureKeepBackupsFolder(currentAuth.accessToken).then((defaultFolderId) => {
          if (defaultFolderId && defaultFolderId !== 'root') {
            // If user hasn't set custom folder yet, set default to Google Keep Backups
            if (selectedExportFolder.name === 'Google Keep Backups') {
              saveExportFolder({ id: defaultFolderId, name: 'Google Keep Backups' });
            }
          }
        });

        loadFolderContents(currentAuth.accessToken, currentFolder.id, isSearchingAllDrive);
      }
    }
  }, [isGoogleDriveModalOpen, currentFolder.id, isSearchingAllDrive, loadFolderContents]);

  if (!isGoogleDriveModalOpen) return null;

  // Navigate to a folder
  const navigateToFolder = (folder: { id: string; name: string }) => {
    if (!authState.accessToken) return;
    setIsSearchingAllDrive(false);
    setCurrentFolder(folder);

    // Update breadcrumbs
    const existingIndex = breadcrumbs.findIndex((b) => b.id === folder.id);
    if (existingIndex >= 0) {
      setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
    } else {
      setBreadcrumbs((prev) => [...prev, folder]);
    }

    loadFolderContents(authState.accessToken, folder.id, false);
  };

  // Navigate one level up
  const navigateUp = () => {
    if (breadcrumbs.length <= 1 || !authState.accessToken) return;
    const parent = breadcrumbs[breadcrumbs.length - 2];
    navigateToFolder(parent);
  };

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

      // Auto ensure folder and load
      const defaultId = await ensureKeepBackupsFolder(res.accessToken);
      if (defaultId && defaultId !== 'root') {
        saveExportFolder({ id: defaultId, name: 'Google Keep Backups' });
      }
      await loadFolderContents(res.accessToken, currentFolder.id, isSearchingAllDrive);
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
    setSubfolders([]);
    setBackups([]);
    setFeedback({ type: 'info', message: 'Disconnected from Google Drive.' });
  };

  // Handle Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.accessToken || !newFolderName.trim()) return;

    setIsSubmittingFolder(true);
    setFeedback(null);

    try {
      const created = await createGoogleDriveFolder(
        authState.accessToken,
        newFolderName.trim(),
        currentFolder.id
      );

      setFeedback({
        type: 'success',
        message: `Created folder "${created.name}" in Google Drive.`,
      });

      setNewFolderName('');
      setIsCreatingFolder(false);

      // Refresh current folder
      await loadFolderContents(authState.accessToken, currentFolder.id, false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create folder in Google Drive.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // Handle Export to Google Drive (using selected folder)
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

      // 2. Upload to the selected destination folder using resumable upload
      const uploadedFile = await uploadBackupToGoogleDrive(
        authState.accessToken,
        blob,
        filename,
        selectedExportFolder.id
      );

      setFeedback({
        type: 'success',
        message: `Export successful! Saved "${uploadedFile.name}" (${notesCount} notes, ${mediaCount} media files) into "${selectedExportFolder.name}".`,
      });

      // 3. Refresh file list in current folder
      await loadFolderContents(authState.accessToken, currentFolder.id, isSearchingAllDrive);
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
                  Folder Sync
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Choose custom folders to export notes or restore intelligent backups
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
                        Under <b>Authorized JavaScript origins</b>, add your app URL:
                        <code className="ml-1 px-1.5 py-0.5 bg-white/70 dark:bg-black/30 rounded font-mono text-[11px]">
                          {typeof window !== 'undefined' ? window.location.origin : 'https://notes-manager-keep.vercel.app'}
                        </code>
                      </li>
                      <li>Copy the generated <b>Client ID</b> and paste it below.</li>
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

          {/* Section: One-Click Export with Target Folder */}
          <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-900/30">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-blue-500" />
                Upload New Backup to Google Drive
              </label>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {notes.length} notes ready
              </span>
            </div>

            {/* Destination Folder Selector Display */}
            <div className="flex items-center justify-between p-2.5 mb-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-blue-700 dark:text-blue-300 font-medium shrink-0">
                  Destination Folder:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/10 text-blue-900 dark:text-blue-200 font-semibold truncate">
                  <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  {selectedExportFolder.name}
                </span>
              </div>

              {authState.isConnected && currentFolder.id !== selectedExportFolder.id && (
                <button
                  type="button"
                  onClick={() => saveExportFolder(currentFolder)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-[11px] shrink-0 transition-colors shadow-xs"
                >
                  Set Current ({currentFolder.name})
                </button>
              )}
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Bundles all your local notes, attachments, drawings, and markdown files into a single ZIP archive directly into your chosen folder.
            </p>

            <button
              type="button"
              onClick={handleExportToDrive}
              disabled={!authState.isConnected || isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md transition-all"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Packaging &amp; Uploading to &quot;{selectedExportFolder.name}&quot;...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>Export Notes to &quot;{selectedExportFolder.name}&quot;</span>
                </>
              )}
            </button>
          </div>

          <hr className="border-stone-200 dark:border-stone-800" />

          {/* Section: Google Drive Folder Navigator & Backups */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Google Drive Folder &amp; Backup Navigator
                </h4>
              </div>

              {authState.isConnected && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                    <span>+ New Folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      authState.accessToken &&
                      loadFolderContents(authState.accessToken, currentFolder.id, isSearchingAllDrive)
                    }
                    disabled={isLoadingContents}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-xs font-medium transition-colors"
                    title="Refresh folder contents"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingContents ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              )}
            </div>

            {/* Create Folder Form Popover */}
            {isCreatingFolder && (
              <form
                onSubmit={handleCreateFolder}
                className="p-3 mb-3 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row items-center gap-2 text-xs animate-in fade-in"
              >
                <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-medium text-stone-800 dark:text-stone-200 shrink-0">
                  New Folder in &quot;{currentFolder.name}&quot;:
                </span>
                <input
                  type="text"
                  placeholder="e.g. Work Backups"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSubmittingFolder || !newFolderName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition-colors"
                >
                  {isSubmittingFolder ? 'Creating...' : 'Create Folder'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-2 py-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Breadcrumb Navigation Bar */}
            {authState.isConnected && (
              <div className="flex items-center justify-between p-2 mb-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100/70 dark:bg-stone-900/60 text-xs overflow-x-auto">
                <div className="flex items-center gap-1 min-w-0">
                  {breadcrumbs.length > 1 && (
                    <button
                      type="button"
                      onClick={navigateUp}
                      className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 mr-1"
                      title="Go up to parent folder"
                    >
                      <CornerLeftUp className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {breadcrumbs.map((b, idx) => (
                    <React.Fragment key={b.id}>
                      {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => navigateToFolder(b)}
                        className={`px-1.5 py-0.5 rounded font-medium truncate max-w-[140px] transition-colors ${
                          idx === breadcrumbs.length - 1
                            ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/10'
                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                        }`}
                      >
                        {b.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Select as destination folder button */}
                  <button
                    type="button"
                    onClick={() => saveExportFolder(currentFolder)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      selectedExportFolder.id === currentFolder.id
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                    title="Export future backups to this folder"
                  >
                    {selectedExportFolder.id === currentFolder.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Export Target</span>
                      </>
                    ) : (
                      <span>Set as Export Target</span>
                    )}
                  </button>

                  {/* Toggle: Search All vs Current Folder */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isSearchingAllDrive;
                      setIsSearchingAllDrive(next);
                      if (authState.accessToken) {
                        loadFolderContents(authState.accessToken, currentFolder.id, next);
                      }
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      isSearchingAllDrive
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-semibold'
                        : 'border-stone-300 dark:border-stone-700 text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {isSearchingAllDrive ? 'Showing All Backups' : 'In Current Folder'}
                  </button>
                </div>
              </div>
            )}

            {/* Folder Contents Display */}
            {!authState.isConnected ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-400 text-xs">
                Connect your Google Drive above to navigate folders and manage backups.
              </div>
            ) : isLoadingContents ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-stone-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span>Loading folder contents from Google Drive...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 1. Subfolders list */}
                {!isSearchingAllDrive && subfolders.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5 px-1">
                      Folders ({subfolders.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {subfolders.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 dark:hover:border-blue-800 transition-all text-xs group"
                        >
                          <button
                            type="button"
                            onClick={() => navigateToFolder({ id: f.id, name: f.name })}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left"
                            title={`Open folder "${f.name}"`}
                          >
                            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                              {f.name}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => saveExportFolder({ id: f.id, name: f.name })}
                            className={`p-1 rounded text-[10px] font-medium opacity-60 hover:opacity-100 transition-opacity ${
                              selectedExportFolder.id === f.id
                                ? 'text-emerald-600 font-bold'
                                : 'text-stone-400 hover:text-blue-600'
                            }`}
                            title="Set as destination folder for exports"
                          >
                            {selectedExportFolder.id === f.id ? '✓ Target' : 'Set Target'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Backup Files list */}
                <div>
                  <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
                    <span>
                      {isSearchingAllDrive ? 'All Drive Backups' : `Backups in "${currentFolder.name}"`} ({backups.length})
                    </span>
                  </div>

                  {backups.length === 0 ? (
                    <div className="p-6 text-center rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs space-y-1">
                      <FolderCheck className="w-6 h-6 text-stone-400 mx-auto mb-1 stroke-1" />
                      <p className="font-medium text-stone-700 dark:text-stone-300">
                        No backup archives in this folder yet.
                      </p>
                      <p className="text-[11px] text-stone-400">
                        Export your notes here or navigate to another folder.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden max-h-56 overflow-y-auto">
                      {backups.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 bg-white dark:bg-[#202124] hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <FileArchive className="w-3.5 h-3.5" />
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
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-xs"
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
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Files are encrypted in transit and stored safely in your personal Google Drive.</span>
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
