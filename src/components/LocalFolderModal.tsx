'use client';

import React, { useState, useEffect } from 'react';
import { FolderOpen, X, Check, HardDrive, Sparkles, RefreshCw } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { saveSettingToDB } from '@/lib/db';

interface LocalFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocalFolderModal: React.FC<LocalFolderModalProps> = ({ isOpen, onClose }) => {
  const { localMediaFolder, setLocalMediaFolder } = useKeep();
  const [folderInput, setFolderInput] = useState(localMediaFolder || '');
  const [isPickingNative, setIsPickingNative] = useState(false);
  const [browserHandleName, setBrowserHandleName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderInput(localMediaFolder || '');
      setStatusMessage(null);
      // Fetch default folder if none set yet
      if (!localMediaFolder) {
        fetch('/api/local-media?action=default')
          .then((r) => r.json())
          .then((data) => {
            if (data.defaultFolder) {
              setFolderInput(data.defaultFolder);
              setLocalMediaFolder(data.defaultFolder);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, localMediaFolder, setLocalMediaFolder]);

  if (!isOpen) return null;

  const handleBrowseNativeOSFolder = async () => {
    try {
      setIsPickingNative(true);
      setStatusMessage(null);
      const res = await fetch('/api/local-media/pick-folder', { method: 'POST' });
      const data = await res.json();
      if (data.folderPath) {
        setFolderInput(data.folderPath);
        setLocalMediaFolder(data.folderPath);
        setStatusMessage('Folder selected and saved!');
      } else if (data.defaultFolder && !folderInput) {
        setFolderInput(data.defaultFolder);
      }
    } catch (err) {
      console.error('Native folder picker error:', err);
    } finally {
      setIsPickingNative(false);
    }
  };

  const handlePickBrowserDirectory = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (typeof win.showDirectoryPicker !== 'function') {
        alert('Browser Directory Picker is not supported in this browser. Use the Browse Folder button or type the folder path above.');
        return;
      }
      const handle = await win.showDirectoryPicker({ mode: 'readwrite' });
      if (handle) {
        await saveSettingToDB('browserDirectoryHandle', handle);
        setBrowserHandleName(handle.name);
        setStatusMessage(`Connected browser directory: "${handle.name}"`);
      }
    } catch (err) {
      // User cancelled
      console.warn('Directory picker cancelled:', err);
    }
  };

  const handleSaveManualPath = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = folderInput.trim();
    if (cleaned) {
      setLocalMediaFolder(cleaned);
      setStatusMessage('Local folder path saved!');
      setTimeout(() => {
        onClose();
      }, 450);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#202124] border border-stone-200 dark:border-stone-700 shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                Local Paste Media Folder
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Pasted images & files are automatically copied here
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSaveManualPath} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Target Local Folder Path
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="e.g. Q:\ANGELCHO\Apps\Keep-Clone\local-media"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-[#2c2d30] border border-stone-300 dark:border-stone-600 text-sm text-stone-800 dark:text-stone-100 font-mono outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={handleBrowseNativeOSFolder}
                disabled={isPickingNative}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 font-semibold text-sm flex items-center gap-2 shrink-0 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {isPickingNative ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
                Browse…
              </button>
            </div>
          </div>

          {/* Optional Browser File System API handle */}
          <div className="p-3.5 rounded-xl bg-stone-100/80 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <HardDrive className="w-4 h-4 text-stone-500 shrink-0" />
              <div className="text-xs text-stone-600 dark:text-stone-300 truncate">
                {browserHandleName ? (
                  <span>
                    Browser folder linked: <strong className="font-mono">{browserHandleName}</strong>
                  </span>
                ) : (
                  <span>Optional: Also mirror pasted files via Browser Directory Picker</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handlePickBrowserDirectory}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-stone-700 border border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 shrink-0 transition-colors"
            >
              Pick Browser Folder
            </button>
          </div>

          {/* Info box */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-stone-700 dark:text-stone-300 space-y-1.5 leading-relaxed">
            <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              How Paste & Copy Works
            </div>
            <p>
              Press <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[11px]">Ctrl+V</kbd> (or drag & drop) inside any note with one or more <strong>images</strong> or <strong>files</strong> on your clipboard:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Each image/file is immediately copied into your chosen local folder.</li>
              <li>A Markdown link (<code className="font-mono">![name](path)</code> or <code className="font-mono">[name](path)</code>) is inserted into the note and rendered live.</li>
            </ul>
          </div>

          {statusMessage && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              {statusMessage}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity"
            >
              Save Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
