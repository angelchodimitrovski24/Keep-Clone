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
  Search,
  HardDrive,
  Info,
  FolderCheck,
  Globe,
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
  getAllGoogleDriveFolders,
  createGoogleDriveFolder,
  ensureKeepBackupsFolder,
  formatBytes,
  GoogleDriveAuthState,
  GoogleDriveFile,
  GoogleDriveFolder,
  STORAGE_KEY_EXPORT_FOLDER,
  STORAGE_KEY_IMPORT_FOLDER,
  getStoredExportFolder,
  saveStoredExportFolder,
  getStoredImportFolder,
  saveStoredImportFolder,
  StoredDriveFolder,
} from '@/lib/googleDrive';
import { getSettingFromDB, saveSettingToDB } from '@/lib/db';

export const GoogleDriveModal: React.FC = () => {
  const {
    isGoogleDriveModalOpen,
    setIsGoogleDriveModalOpen,
    importDataSmart,
    notes,
  } = useKeep();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [authState, setAuthState] = useState<GoogleDriveAuthState>(() => getStoredDriveAuth());
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Folders list across Drive
  const [allFolders, setAllFolders] = useState<GoogleDriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  // Selected folder for Export (persisted in localStorage and IndexedDB)
  const [exportFolder, setExportFolder] = useState<StoredDriveFolder>(() => {
    return getStoredExportFolder() || { id: 'root', name: 'Google Keep Backups' };
  });
  const [isExportFolderPickerOpen, setIsExportFolderPickerOpen] = useState(false);

  // Selected folder for Import (persisted in localStorage and IndexedDB)
  const [importFolder, setImportFolder] = useState<StoredDriveFolder>(() => {
    return getStoredImportFolder() || { id: 'all', name: 'All Drive Backups' };
  });
  const [isImportFolderPickerOpen, setIsImportFolderPickerOpen] = useState(false);

  // Backups list for import
  const [backups, setBackups] = useState<GoogleDriveFile[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  // Inline Create Folder
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load all folders from Google Drive
  const loadAllFolders = useCallback(async (token: string) => {
    setIsLoadingFolders(true);
    try {
      const folders = await getAllGoogleDriveFolders(token);
      setAllFolders(folders);
      return folders;
    } catch (err: unknown) {
      console.warn('Failed to load folders:', err);
      return [];
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // Load backups for the selected import folder
  const loadBackupsForFolder = useCallback(async (token: string, folderId: string) => {
    setIsLoadingBackups(true);
    setFeedback(null);
    try {
      const files = await listGoogleDriveBackups(token, folderId);
      setBackups(files);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load backups from Google Drive.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsLoadingBackups(false);
    }
  }, []);

  // Save selected export folder (persists in localStorage + IndexedDB)
  const selectExportFolder = (folder: { id: string; name: string }) => {
    setExportFolder(folder);
    saveStoredExportFolder(folder);
    saveSettingToDB(STORAGE_KEY_EXPORT_FOLDER, folder).catch(() => {});
    setIsExportFolderPickerOpen(false);
    setFeedback({
      type: 'info',
      message: `Selected "${folder.name}" as destination folder. This choice is remembered.`,
    });
  };

  // Select import folder (persists in localStorage + IndexedDB)
  const selectImportFolder = (folder: { id: string; name: string }) => {
    setImportFolder(folder);
    saveStoredImportFolder(folder);
    saveSettingToDB(STORAGE_KEY_IMPORT_FOLDER, folder).catch(() => {});
    setIsImportFolderPickerOpen(false);
    if (authState.accessToken) {
      loadBackupsForFolder(authState.accessToken, folder.id);
    }
  };

  // Restore folder preferences from IndexedDB if localStorage was empty
  useEffect(() => {
    getSettingFromDB<StoredDriveFolder | null>(STORAGE_KEY_EXPORT_FOLDER, null)
      .then((folder) => {
        if (folder && !getStoredExportFolder()) {
          setExportFolder(folder);
          saveStoredExportFolder(folder);
        }
      })
      .catch(() => {});

    getSettingFromDB<StoredDriveFolder | null>(STORAGE_KEY_IMPORT_FOLDER, null)
      .then((folder) => {
        if (folder && !getStoredImportFolder()) {
          setImportFolder(folder);
          saveStoredImportFolder(folder);
        }
      })
      .catch(() => {});
  }, []);

  // Sync state whenever modal opens
  useEffect(() => {
    if (!isGoogleDriveModalOpen) return;

    const currentAuth = getStoredDriveAuth();
    setAuthState(currentAuth);
    setClientIdInput(currentAuth.clientId || getStoredClientId());
    setFeedback(null);

    // Make sure we have the latest saved export folder
    const savedExport = getStoredExportFolder();
    if (savedExport) {
      setExportFolder(savedExport);
    }

    if (currentAuth.isConnected && currentAuth.accessToken) {
      // Load all folders
      loadAllFolders(currentAuth.accessToken).then((folders) => {
        const stored = getStoredExportFolder();
        if (stored) {
          // The user explicitly chose a folder! Keep their selection intact.
          // If the folder exists in Drive and was renamed, update its name.
          const matched = folders.find((f) => f.id === stored.id);
          if (matched && matched.name !== stored.name) {
            const updated = { id: matched.id, name: matched.name };
            setExportFolder(updated);
            saveStoredExportFolder(updated);
            saveSettingToDB(STORAGE_KEY_EXPORT_FOLDER, updated).catch(() => {});
          }
          return;
        }

        // Only run if the user has NEVER chosen a destination folder:
        const defaultKeepFolder = folders.find((f) => f.name === 'Google Keep Backups');
        if (defaultKeepFolder) {
          const initFolder = { id: defaultKeepFolder.id, name: defaultKeepFolder.name };
          setExportFolder(initFolder);
          saveStoredExportFolder(initFolder);
          saveSettingToDB(STORAGE_KEY_EXPORT_FOLDER, initFolder).catch(() => {});
        } else {
          // Auto ensure it
          ensureKeepBackupsFolder(currentAuth.accessToken!).then((id) => {
            if (id && id !== 'root') {
              const initFolder = { id, name: 'Google Keep Backups' };
              setExportFolder(initFolder);
              saveStoredExportFolder(initFolder);
              saveSettingToDB(STORAGE_KEY_EXPORT_FOLDER, initFolder).catch(() => {});
            }
          });
        }
      });

      // Load backups for current import folder
      const curImport = getStoredImportFolder() || importFolder;
      loadBackupsForFolder(currentAuth.accessToken, curImport.id);
    }
  }, [isGoogleDriveModalOpen, loadAllFolders, loadBackupsForFolder]);

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

      await loadAllFolders(res.accessToken);
      await loadBackupsForFolder(res.accessToken, importFolder.id);
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
    setAllFolders([]);
    setBackups([]);
    setFeedback({ type: 'info', message: 'Disconnected from Google Drive.' });
  };

  // Handle Create New Folder
  const handleCreateFolder = async (e: React.FormEvent, forTarget: 'export' | 'import') => {
    e.preventDefault();
    if (!authState.accessToken || !newFolderName.trim()) return;

    setIsSubmittingFolder(true);
    setFeedback(null);

    try {
      const created = await createGoogleDriveFolder(
        authState.accessToken,
        newFolderName.trim(),
        'root'
      );

      setFeedback({
        type: 'success',
        message: `Created folder "${created.name}" in Google Drive.`,
      });

      setNewFolderName('');
      setIsCreatingFolder(false);

      // Refresh folders list
      const refreshedFolders = await loadAllFolders(authState.accessToken);

      // Automatically select the new folder
      if (forTarget === 'export') {
        selectExportFolder({ id: created.id, name: created.name });
      } else {
        selectImportFolder({ id: created.id, name: created.name });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create folder in Google Drive.';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmittingFolder(false);
    }
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

      // 2. Upload to selected export folder using resumable upload
      const uploadedFile = await uploadBackupToGoogleDrive(
        authState.accessToken,
        blob,
        filename,
        exportFolder.id
      );

      setFeedback({
        type: 'success',
        message: `Export successful! Saved "${uploadedFile.name}" (${notesCount} notes, ${mediaCount} media files) into "${exportFolder.name}".`,
      });

      // 3. Refresh backups if viewing that folder
      if (importFolder.id === exportFolder.id || importFolder.id === 'all') {
        await loadBackupsForFolder(authState.accessToken, importFolder.id);
      }
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
      const downloadedFile = await downloadGoogleDriveBackup(
        authState.accessToken,
        file.id,
        file.name
      );

      // Close this modal to show the ImportSummaryModal
      setIsGoogleDriveModalOpen(false);

      // Run intelligent reconciliation import pipeline
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

  // Filtered folders by search query
  const filteredFolders = allFolders.filter((f) =>
    f.name.toLowerCase().includes(folderSearchQuery.toLowerCase())
  );

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
                  Custom Folders
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Choose any folder in your Google Drive to export or import notes
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

        {/* Modal Navigation Tabs (Export vs Import) */}
        {authState.isConnected && (
          <div className="flex items-center border-b border-stone-200 dark:border-stone-800 px-6 bg-stone-50/60 dark:bg-stone-900/40 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('export');
                setIsExportFolderPickerOpen(false);
                setIsImportFolderPickerOpen(false);
              }}
              className={`flex items-center gap-2 py-3 px-4 font-semibold border-b-2 transition-all ${
                activeTab === 'export'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <CloudUpload className="w-4 h-4" />
              <span>Export to Google Drive</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('import');
                setIsExportFolderPickerOpen(false);
                setIsImportFolderPickerOpen(false);
                if (authState.accessToken) {
                  loadBackupsForFolder(authState.accessToken, importFolder.id);
                }
              }}
              className={`flex items-center gap-2 py-3 px-4 font-semibold border-b-2 transition-all ${
                activeTab === 'import'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <CloudDownload className="w-4 h-4" />
              <span>Import from Google Drive</span>
            </button>
          </div>
        )}

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
                      className="w-9 h-9 rounded-full border border-emerald-500 ring-2 ring-emerald-500/20"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
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

          {!authState.isConnected ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-stone-400 text-xs">
              Sign in with Google above to open folders, choose destination folders, and export/import notes.
            </div>
          ) : activeTab === 'export' ? (
            /* ======================================================== */
            /* TAB 1: EXPORT TO GOOGLE DRIVE WITH FOLDER CHOOSER        */
            /* ======================================================== */
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-blue-500" />
                    Export Notes to Google Drive
                  </span>
                  <span className="text-xs font-normal text-stone-500">
                    {notes.length} notes ready
                  </span>
                </label>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Select which folder in your Google Drive will receive your full notes backup ZIP bundle.
                </p>
              </div>

              {/* Destination Folder Banner with "Choose Folder" Button */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                          Destination Folder
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Remembered
                        </span>
                      </div>
                      <div className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate" title={exportFolder.name}>
                        {exportFolder.name}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportFolderPickerOpen(!isExportFolderPickerOpen);
                      if (!isExportFolderPickerOpen && authState.accessToken) {
                        loadAllFolders(authState.accessToken);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0"
                  >
                    <Folder className="w-4 h-4" />
                    <span>{isExportFolderPickerOpen ? 'Hide Folders' : 'Choose / Change Folder'}</span>
                  </button>
                </div>

                {/* Interactive Folder Picker (when opened) */}
                {isExportFolderPickerOpen && (
                  <div className="pt-3 border-t border-blue-200/70 dark:border-blue-900/40 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Search folders..."
                          value={folderSearchQuery}
                          onChange={(e) => setFolderSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium transition-colors shrink-0"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ New Folder</span>
                      </button>
                    </div>

                    {/* Inline Create Folder Input */}
                    {isCreatingFolder && (
                      <form
                        onSubmit={(e) => handleCreateFolder(e, 'export')}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-stone-800 border border-blue-400 text-xs animate-in fade-in"
                      >
                        <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
                        <input
                          type="text"
                          placeholder="Enter new folder name..."
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          autoFocus
                          className="flex-1 px-2.5 py-1 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={isSubmittingFolder || !newFolderName.trim()}
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs"
                        >
                          {isSubmittingFolder ? 'Creating...' : 'Create & Select'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingFolder(false)}
                          className="px-2 py-1 text-stone-500 hover:text-stone-800"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {/* Folders List Grid */}
                    {isLoadingFolders ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-xs text-stone-400">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span>Loading folders from Google Drive...</span>
                      </div>
                    ) : filteredFolders.length === 0 ? (
                      <div className="p-4 text-center text-xs text-stone-400">
                        No folders found matching &quot;{folderSearchQuery}&quot;. Click &quot;+ New Folder&quot; to create one.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                        {filteredFolders.map((f) => {
                          const isSelected = exportFolder.id === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => selectExportFolder({ id: f.id, name: f.name })}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white font-semibold shadow-xs'
                                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-blue-300 text-stone-800 dark:text-stone-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />
                                <span className="truncate">{f.name}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button: Export Current Notes to Chosen Folder */}
              <button
                type="button"
                onClick={handleExportToDrive}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Packaging &amp; Uploading to &quot;{exportFolder.name}&quot;...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Export All Notes to &quot;{exportFolder.name}&quot;</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* ======================================================== */
            /* TAB 2: IMPORT FROM GOOGLE DRIVE WITH FOLDER CHOOSER        */
            /* ======================================================== */
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2">
                    <CloudDownload className="w-4 h-4 text-emerald-500" />
                    Import Backups from Google Drive
                  </span>
                  <span className="text-xs font-normal text-stone-500">
                    {backups.length} backup{backups.length !== 1 ? 's' : ''} found
                  </span>
                </label>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Choose which folder to restore from. Smart restore only updates changed notes and skips duplicates.
                </p>
              </div>

              {/* Source Folder Banner with "Choose Folder" Button */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      {importFolder.id === 'all' ? (
                        <Globe className="w-5 h-5" />
                      ) : (
                        <FolderOpen className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                          Source Folder
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Remembered
                        </span>
                      </div>
                      <div className="font-bold text-sm text-stone-900 dark:text-stone-100 truncate" title={importFolder.name}>
                        {importFolder.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportFolderPickerOpen(!isImportFolderPickerOpen);
                        if (!isImportFolderPickerOpen && authState.accessToken) {
                          loadAllFolders(authState.accessToken);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>{isImportFolderPickerOpen ? 'Hide Folders' : 'Choose Folder'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        authState.accessToken && loadBackupsForFolder(authState.accessToken, importFolder.id)
                      }
                      disabled={isLoadingBackups}
                      className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 transition-colors"
                      title="Refresh backups list"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Interactive Folder Picker for Import */}
                {isImportFolderPickerOpen && (
                  <div className="pt-3 border-t border-emerald-200/70 dark:border-emerald-900/40 space-y-3 animate-in fade-in">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Search folders to import from..."
                        value={folderSearchQuery}
                        onChange={(e) => setFolderSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                      {/* Special option: All Drive */}
                      <button
                        type="button"
                        onClick={() => selectImportFolder({ id: 'all', name: 'All Drive Backups (Search Everywhere)' })}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all ${
                          importFolder.id === 'all'
                            ? 'border-emerald-600 bg-emerald-600 text-white font-semibold shadow-xs'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-emerald-300 text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className={`w-4 h-4 shrink-0 ${importFolder.id === 'all' ? 'text-white' : 'text-blue-500'}`} />
                          <span className="truncate">All Drive Backups</span>
                        </div>
                        {importFolder.id === 'all' && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                      </button>

                      {filteredFolders.map((f) => {
                        const isSelected = importFolder.id === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => selectImportFolder({ id: f.id, name: f.name })}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white font-semibold shadow-xs'
                                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-emerald-300 text-stone-800 dark:text-stone-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />
                              <span className="truncate">{f.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Backups List in Selected Folder */}
              {isLoadingBackups ? (
                <div className="p-8 flex flex-col items-center justify-center gap-2 text-stone-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                  <span>Searching &quot;{importFolder.name}&quot; for backups...</span>
                </div>
              ) : backups.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs space-y-1">
                  <FolderCheck className="w-8 h-8 text-stone-400 mx-auto mb-1 stroke-1" />
                  <p className="font-medium text-stone-700 dark:text-stone-300">
                    No backup files found in &quot;{importFolder.name}&quot;.
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Click &quot;Choose Folder&quot; above to select another folder or choose &quot;All Drive Backups&quot;.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden max-h-64 overflow-y-auto">
                  {backups.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-white dark:bg-[#202124] hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
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
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs"
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
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Your notes are backed up directly to your personal Google Drive account.</span>
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
