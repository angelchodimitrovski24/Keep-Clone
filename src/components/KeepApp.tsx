'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useKeep } from '@/context/KeepContext';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { CreateNoteBar } from '@/components/CreateNoteBar';
import { NotesGrid } from '@/components/NotesGrid';
import { NoteModal } from '@/components/NoteModal';
import { NoteTabsBar } from '@/components/NoteTabsBar';
import { DrawingModal } from '@/components/DrawingModal';
import { LabelManagerModal } from '@/components/LabelManagerModal';
import { CategoryManagerModal } from '@/components/CategoryManagerModal';
import { CategoryPillsBar } from '@/components/CategoryPillsBar';
import { LocalFolderModal } from '@/components/LocalFolderModal';
import { SettingsModal } from '@/components/SettingsModal';
import { UnlockCategoryModal } from '@/components/UnlockCategoryModal';
import { NoteVersionModal } from '@/components/NoteVersionModal';
import { ReadingStatsView } from '@/components/ReadingStatsView';
import { CalendarView } from '@/components/CalendarView';
import { CalendarReminderToast } from '@/components/CalendarReminderToast';
import { ImportSummaryModal } from '@/components/ImportSummaryModal';
import { ShareNoteModal } from '@/components/ShareNoteModal';
import { GoogleDriveModal } from '@/components/GoogleDriveModal';
import { PdfExportModal } from '@/components/PdfExportModal';
import { InstallAppModal } from '@/components/InstallAppModal';
import { AndroidInstallBanner } from '@/components/AndroidInstallBanner';
import { ActiveStopwatchDock } from '@/components/ActiveStopwatchDock';
import { CreateNoteByDateModal } from '@/components/CreateNoteByDateModal';
import { NotionTemplateModal } from '@/components/NotionTemplateModal';
import { Note, NoteDrawing } from '@/types/note';

interface KeepAppProps {
  initialNoteId?: string;
}

export function KeepApp({ initialNoteId }: KeepAppProps) {
  const {
    notes,
    isLoading,
    editingNote,
    setEditingNote,
    isDrawingModalOpen,
    setIsDrawingModalOpen,
    drawingNoteId,
    isLabelModalOpen,
    setIsLabelModalOpen,
    isCategoryModalOpen,
    setIsCategoryModalOpen,
    isLocalFolderModalOpen,
    setIsLocalFolderModalOpen,
    updateNote,
    addNote,
    currentFilter,
    selectedCategory,
    selectedLabel,
    importSummary,
    setImportSummary,
    sharingNote,
    setSharingNote,
    setCurrentFilter,
  } = useKeep();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pendingNoteIdRef = useRef<string | null>(initialNoteId || null);
  const [noteNotFoundId, setNoteNotFoundId] = useState<string | null>(null);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Read URL parameters on mount if no initialNoteId prop was passed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.location.pathname === '/calendar') {
      setCurrentFilter('calendar');
    } else if (window.location.pathname === '/stats') {
      setCurrentFilter('stats');
    }

    if (!pendingNoteIdRef.current) {
      const match = window.location.pathname.match(/^\/note\/([^/]+)/);
      if (match && match[1]) {
        pendingNoteIdRef.current = decodeURIComponent(match[1]);
      } else {
        const queryNote = new URLSearchParams(window.location.search).get('note');
        if (queryNote) {
          pendingNoteIdRef.current = queryNote;
        }
      }
    }
  }, []);

  // When notes are loaded from IndexedDB, open the pending note if present
  useEffect(() => {
    if (pendingNoteIdRef.current && !isLoading) {
      const targetId = pendingNoteIdRef.current;
      const found = notes.find((n) => n.id === targetId);
      if (found) {
        setOpenTabIds((prev) => (prev.includes(found.id) ? prev : [...prev, found.id]));
        setActiveTabId(found.id);
        setEditingNote(found);
        pendingNoteIdRef.current = null;
        setNoteNotFoundId(null);
      } else {
        console.warn(`Note with ID ${targetId} not found in notes.`);
        setNoteNotFoundId(targetId);
        pendingNoteIdRef.current = null;
      }
    }
  }, [notes, isLoading, setEditingNote]);

  // Whenever editingNote changes from outside (e.g. reminders, docks), sync to tabs
  useEffect(() => {
    if (editingNote) {
      setOpenTabIds((prev) => (prev.includes(editingNote.id) ? prev : [...prev, editingNote.id]));
      setActiveTabId(editingNote.id);
      setNoteNotFoundId(null);
    }
  }, [editingNote]);

  // Tab action handlers
  const openNoteInTab = (noteId: string) => {
    const found = notes.find((n) => n.id === noteId);
    if (!found) return;
    setOpenTabIds((prev) => (prev.includes(noteId) ? prev : [...prev, noteId]));
    setActiveTabId(noteId);
    setEditingNote(found);
    setNoteNotFoundId(null);
    const targetPath = `/note/${encodeURIComponent(noteId)}`;
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ noteId }, '', targetPath);
    }
    if (typeof document !== 'undefined') {
      document.title = `${found.title || 'Untitled'} - Keep Clone`;
    }
  };

  const closeNoteTab = (noteId: string) => {
    setOpenTabIds((prev) => {
      const next = prev.filter((id) => id !== noteId);
      if (activeTabId === noteId) {
        if (next.length > 0) {
          const nextActiveId = next[next.length - 1];
          setActiveTabId(nextActiveId);
          const nextNote = notes.find((n) => n.id === nextActiveId) || null;
          setEditingNote(nextNote);
          if (nextNote && typeof window !== 'undefined') {
            window.history.pushState({ noteId: nextActiveId }, '', `/note/${encodeURIComponent(nextActiveId)}`);
            document.title = `${nextNote.title || 'Note'} - Keep Clone`;
          }
        } else {
          setActiveTabId(null);
          setEditingNote(null);
          if (typeof window !== 'undefined') {
            const revertPath = currentFilter === 'calendar' ? '/calendar' : currentFilter === 'stats' ? '/stats' : '/';
            window.history.pushState(null, '', revertPath);
            document.title = currentFilter === 'calendar' ? 'Calendar - Keep Clone' : currentFilter === 'stats' ? 'Reading Stats - Keep Clone' : 'Google Keep Clone';
          }
        }
      }
      return next;
    });
  };

  const handleSelectMainTab = () => {
    setActiveTabId(null);
    setEditingNote(null);
    if (typeof window !== 'undefined') {
      const revertPath = currentFilter === 'calendar' ? '/calendar' : currentFilter === 'stats' ? '/stats' : '/';
      if (window.location.pathname !== revertPath) {
        window.history.pushState(null, '', revertPath);
      }
      document.title = currentFilter === 'calendar' ? 'Calendar - Keep Clone' : currentFilter === 'stats' ? 'Reading Stats - Keep Clone' : 'Google Keep Clone';
    }
  };

  const handleNewNoteTab = async () => {
    const newNote = await addNote({
      title: '',
      content: '',
    });
    openNoteInTab(newNote.id);
  };

  // Synchronize editingNote with browser URL address bar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPath = window.location.pathname;

    if (activeTabId) {
      const targetPath = `/note/${encodeURIComponent(activeTabId)}`;
      if (currentPath !== targetPath) {
        window.history.pushState({ noteId: activeTabId }, '', targetPath);
      }
    } else {
      if (currentPath.startsWith('/note/')) {
        const revertPath = currentFilter === 'calendar' ? '/calendar' : currentFilter === 'stats' ? '/stats' : '/';
        window.history.pushState(null, '', revertPath);
        document.title = currentFilter === 'calendar' ? 'Calendar - Keep Clone' : currentFilter === 'stats' ? 'Reading Stats - Keep Clone' : 'Google Keep Clone';
      }
    }
  }, [activeTabId, currentFilter]);

  // Listen to browser Back / Forward buttons (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/note\/([^/]+)/);

      if (match && match[1]) {
        const noteId = decodeURIComponent(match[1]);
        const target = notes.find((n) => n.id === noteId);
        if (target) {
          setOpenTabIds((prev) => (prev.includes(noteId) ? prev : [...prev, noteId]));
          setActiveTabId(noteId);
          setEditingNote(target);
        } else {
          setActiveTabId(null);
          setEditingNote(null);
        }
      } else {
        setActiveTabId(null);
        setEditingNote(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [notes, setEditingNote]);

  const activeTabNote = useMemo(() => {
    if (!activeTabId) return null;
    return notes.find((n) => n.id === activeTabId) || (editingNote?.id === activeTabId ? editingNote : null);
  }, [activeTabId, notes, editingNote]);

  const handleSaveDrawing = async (drawing: NoteDrawing) => {
    if (drawingNoteId) {
      // Add to existing note
      const current = editingNote;
      if (current && current.id === drawingNoteId) {
        await updateNote(drawingNoteId, {
          drawings: [...(current.drawings || []), drawing],
        });
      }
    } else {
      // Create new note with drawing
      await addNote({
        title: 'Drawing',
        drawings: [drawing],
      });
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#18191a] text-stone-900 dark:text-stone-100 flex flex-col transition-colors selection:bg-amber-200 dark:selection:bg-amber-900">
      {/* Top Header */}
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main View Area */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          onOpenLabelModal={() => setIsLabelModalOpen(true)}
        />

        {/* Center Workspace (Tabs Bar + Main Scrollable Area) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Internal Workspace Tabs Bar */}
          <NoteTabsBar
            openTabIds={openTabIds}
            activeTabId={activeTabId}
            notes={notes}
            currentFilter={currentFilter}
            selectedCategory={selectedCategory}
            selectedLabel={selectedLabel}
            onSelectMainTab={handleSelectMainTab}
            onSelectNoteTab={openNoteInTab}
            onCloseNoteTab={closeNoteTab}
            onNewNoteTab={handleNewNoteTab}
          />

          {/* Notes Feed / Active Note Full Page View Container */}
          <main className="flex-1 p-2.5 sm:p-4 md:p-8 overflow-y-auto max-w-[1600px] mx-auto w-full">
            {pendingNoteIdRef.current && isLoading ? (
              <div className="w-full max-w-4xl mx-auto py-24 flex flex-col items-center justify-center text-stone-400">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium">Loading note…</p>
              </div>
            ) : noteNotFoundId ? (
              <div className="w-full max-w-xl mx-auto py-24 text-center select-none">
                <div className="text-5xl mb-4">📝</div>
                <h2 className="text-xl font-bold text-stone-800 dark:text-stone-200 mb-2">Note not found</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
                  The note with ID &quot;{noteNotFoundId}&quot; could not be found or may have been deleted.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNoteNotFoundId(null);
                    handleSelectMainTab();
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Back to all notes
                </button>
              </div>
            ) : activeTabNote ? (
              <NoteModal
                key={activeTabNote.id}
                note={activeTabNote}
                isOpen={true}
                fullPage={true}
                onClose={() => closeNoteTab(activeTabNote.id)}
                onOpenDrawingModal={(noteId) => setIsDrawingModalOpen(true, noteId)}
              />
            ) : currentFilter === 'stats' ? (
              <ReadingStatsView />
            ) : currentFilter === 'calendar' ? (
              <CalendarView />
            ) : (
              <>
                {/* Category Filter Pills */}
                <CategoryPillsBar />

                {/* Note Composer (visible in Notes and Category views) */}
                {(currentFilter === 'notes' || currentFilter === 'category') && (
                  <CreateNoteBar
                    onOpenDrawingModal={() => setIsDrawingModalOpen(true, null)}
                  />
                )}

                {/* Notes Grid Display */}
                <NotesGrid
                  onSelectNote={(note) => {
                    setNoteNotFoundId(null);
                    openNoteInTab(note.id);
                  }}
                  onOpenDrawingModal={(noteId) => setIsDrawingModalOpen(true, noteId)}
                />
              </>
            )}
          </main>
        </div>
      </div>

      {/* Canvas Drawing Modal */}
      <DrawingModal
        isOpen={isDrawingModalOpen}
        onClose={() => setIsDrawingModalOpen(false, null)}
        onSaveDrawing={handleSaveDrawing}
      />

      {/* Label Management Modal */}
      <LabelManagerModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
      />

      {/* Category Management Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      {/* Local Paste Media Folder Modal */}
      <LocalFolderModal
        isOpen={isLocalFolderModalOpen}
        onClose={() => setIsLocalFolderModalOpen(false)}
      />

      {/* Category Unlock Modal */}
      <UnlockCategoryModal />

      {/* Settings Modal */}
      <SettingsModal />

      {/* Note Version History Modal */}
      <NoteVersionModal />

      {/* Intelligent Import Summary Modal */}
      <ImportSummaryModal
        result={importSummary}
        onClose={() => setImportSummary(null)}
      />

      {/* Google Drive Cloud Backup & Restore Modal */}
      <GoogleDriveModal />

      {/* PDF Export Modal (NotebookLM Ready) */}
      <PdfExportModal />

      {/* Share Note Modal with Short Link */}
      <ShareNoteModal
        note={sharingNote}
        isOpen={!!sharingNote}
        onClose={() => setSharingNote(null)}
      />

      {/* Android & Mobile App Installation Modal */}
      <InstallAppModal />

      {/* Android Floating Quick-Install Banner */}
      <AndroidInstallBanner />

      {/* Floating Active Stopwatch Dock (measures reading time across entire app) */}
      <ActiveStopwatchDock />

      {/* Create Note from Date Range Modal (Today, 7d, 14d, 30d, 60d, 90d, 6m, 1y) */}
      <CreateNoteByDateModal />

      {/* Notion Template Hub Modal (Today's Notes, Days, Per Keyword) */}
      <NotionTemplateModal />

      {/* Floating Calendar & Note Reminder Alerts */}
      <CalendarReminderToast />
    </div>
  );
}
