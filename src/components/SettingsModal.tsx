'use client';

import React from 'react';
import {
  X,
  Type,
  Sun,
  Moon,
  Laptop,
  LayoutGrid,
  Rows,
  FolderOpen,
  Download,
  Upload,
  Check,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import { useKeep, getFontSizeInPx } from '@/context/KeepContext';
import { FontSizeOption, AppThemeMode } from '@/types/note';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    fontSize,
    setFontSize,
    themeMode,
    setThemeMode,
    layoutMode,
    setLayoutMode,
    localMediaFolder,
    setIsLocalFolderModalOpen,
    notes,
    labels,
    exportDataJSON,
    importDataJSON,
  } = useKeep();

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isSettingsOpen) return null;

  const fontOptions: { id: FontSizeOption; label: string; desc: string; sizePx: string }[] = [
    { id: 'small', label: 'Small', desc: 'Compact view for high density', sizePx: '13.5px' },
    { id: 'medium', label: 'Medium', desc: 'Default Google Keep reading size', sizePx: '15px' },
    { id: 'large', label: 'Large', desc: 'Enhanced legibility and comfort', sizePx: '17px' },
    { id: 'xlarge', label: 'Extra Large', desc: 'Higher visibility and clarity', sizePx: '20px' },
    { id: 'huge', label: 'Huge', desc: 'Spacious and prominent reading size', sizePx: '24px' },
    { id: 'max', label: 'Maximum', desc: 'Maximum 28px accessibility size', sizePx: '28px' },
  ];

  const currentPxNum = parseInt(getFontSizeInPx(fontSize)) || 15;

  const themeOptions: { id: AppThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'system', label: 'System', icon: <Laptop className="w-4 h-4" /> },
    { id: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
  ];

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = await importDataJSON(content);
        if (ok) {
          alert('Data imported successfully!');
        } else {
          alert('Failed to import JSON data.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      onClick={() => setIsSettingsOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-lg text-stone-900 dark:text-stone-100">
              Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: Note Font Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-stone-500" />
                <label className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Note Font Size
                </label>
              </div>
              <span className="text-xs font-mono text-stone-500 uppercase">
                {fontOptions.find((f) => f.id === fontSize)?.label} ({fontOptions.find((f) => f.id === fontSize)?.sizePx})
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Adjust the reading and editing text size across all notes, checklists, and Markdown previews.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {fontOptions.map((opt) => {
                const isSelected = fontSize === opt.id || getFontSizeInPx(fontSize) === opt.sizePx;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFontSize(opt.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold shadow-xs ring-1 ring-amber-500'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-[11px] text-stone-400 mt-0.5">{opt.sizePx}</span>
                  </button>
                );
              })}
            </div>

            {/* Continuous Font Size Slider (12px to 28px) */}
            <div className="p-3.5 rounded-xl border border-stone-200/90 dark:border-stone-700/80 bg-stone-50/70 dark:bg-stone-900/40 mb-3">
              <div className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-300 mb-2">
                <span className="font-semibold">Smooth Font Size Slider (12px – 28px):</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-md text-xs border border-amber-500/20">
                  {getFontSizeInPx(fontSize)}
                </span>
              </div>
              <input
                type="range"
                min="12"
                max="28"
                step="1"
                value={currentPxNum}
                onChange={(e) => setFontSize(`${e.target.value}px`)}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-200 dark:bg-stone-700 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-stone-400 mt-1.5 font-mono">
                <span>12px</span>
                <span>15px</span>
                <span>18px</span>
                <span>21px</span>
                <span>24px</span>
                <span>28px</span>
              </div>
            </div>

            {/* Live Interactive Font Size Preview Box */}
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 transition-all">
              <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Live Preview (scales text, code, checklists &amp; tables):
              </div>
              <div className="keep-rendered text-stone-800 dark:text-stone-200 space-y-2">
                <h4 className="font-semibold mb-1">Trip to Kyoto &amp; Tokyo 🌸</h4>
                <p>
                  Pack warm clothes and verify train tickets. All note elements scale seamlessly up to 28px!
                </p>
                <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                  <span className="w-3.5 h-3.5 rounded border border-stone-400 flex items-center justify-center text-[10px] text-blue-600 font-bold shrink-0">
                    ✓
                  </span>
                  <span>Confirm hotel reservations in Shibuya</span>
                </div>
                <div>
                  <pre className="font-mono p-2.5 rounded-lg bg-stone-900 text-stone-100 overflow-x-auto">
                    <code>console.log(&quot;Keep notes scaling smoothly!&quot;);</code>
                  </pre>
                </div>
                <div className="keep-table-wrapper overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
                  <table className="keep-table w-full text-left border-collapse">
                    <thead className="bg-black/5 dark:bg-white/5 border-b border-stone-200 dark:border-stone-700">
                      <tr>
                        <th className="px-3 py-1.5 font-semibold border-r border-stone-200/50 dark:border-stone-800 last:border-r-0">Feature</th>
                        <th className="px-3 py-1.5 font-semibold border-r border-stone-200/50 dark:border-stone-800 last:border-r-0">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/60 dark:divide-stone-800/80">
                      <tr>
                        <td className="px-3 py-1.5 border-r border-stone-200/40 dark:border-stone-800/60 last:border-r-0">Tables &amp; Code</td>
                        <td className="px-3 py-1.5 border-r border-stone-200/40 dark:border-stone-800/60 last:border-r-0 font-medium text-emerald-600 dark:text-emerald-400">Scaling Up to 28px</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-stone-200 dark:border-stone-800" />

          {/* Section 2: Appearance & Theme */}
          <div>
            <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 block mb-1">
              Appearance / Theme
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              Choose your interface theme. System automatically matches your OS preference.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const isSelected = themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setThemeMode(opt.id)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all text-sm font-medium ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold ring-1 ring-amber-500 shadow-xs'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-stone-200 dark:border-stone-800" />

          {/* Section 3: Layout */}
          <div>
            <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 block mb-1">
              Notes Layout View
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm transition-all ${
                  layoutMode === 'grid'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Multi-column Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-sm transition-all ${
                  layoutMode === 'list'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-semibold ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Rows className="w-4 h-4" />
                <span>Single-column List</span>
              </button>
            </div>
          </div>

          <hr className="border-stone-200 dark:border-stone-800" />

          {/* Section 4: Local Paste Media Folder */}
          <div>
            <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 block mb-1">
              Local Media Folder
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
              Where pasted images and attachments are saved locally on your drive.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 font-mono text-xs text-stone-600 dark:text-stone-300 truncate">
                {localMediaFolder || 'Default server local-media folder'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsLocalFolderModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-medium text-xs hover:bg-amber-400 transition-colors shadow-xs shrink-0"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Change</span>
              </button>
            </div>
          </div>

          <hr className="border-stone-200 dark:border-stone-800" />

          {/* Section 5: Data & Backup */}
          <div>
            <label className="text-sm font-semibold text-stone-900 dark:text-stone-100 block mb-1">
              Data & Storage
            </label>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
              {notes.length} total notes &bull; {labels.length} labels &bull; Stored locally in IndexedDB.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportDataJSON}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <Download className="w-4 h-4 text-amber-500" />
                <span>Export Backup (JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <Upload className="w-4 h-4 text-blue-500" />
                <span>Import Backup (JSON)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold text-sm hover:opacity-90 transition-opacity shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
