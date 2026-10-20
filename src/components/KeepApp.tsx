'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useKeep } from '@/context/KeepContext';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { CreateNoteBar } from '@/components/CreateNoteBar';
import { NotesGrid } from '@/components/NotesGrid';
import { NoteModal } from '@/components/NoteModal';
import { DrawingModal } from '@/components/DrawingModal';
import { LabelManagerModal } from '@/components/LabelManagerModal';
import { CategoryManagerModal } from '@/components/CategoryManagerModal';
import { CategoryPillsBar } from '@/components/CategoryPillsBar';
import { LocalFolderModal } from '@/components/LocalFolderModal';
import { SettingsModal } from '@/components/SettingsModal';
import { UnlockCategoryModal } from '@/components/UnlockCategoryModal';
import { NoteVersionModal } from '@/components/NoteVersionModal';
import { ReadingStatsView } from '@/components/ReadingStatsView';
import { ImportSummaryModal } from '@/components/ImportSummaryModal';
import { ShareNoteModal } from '@/components/ShareNoteModal';
import { GoogleDriveModal } from '@/components/GoogleDriveModal';
import { PdfExportModal } from '@/components/PdfExportModal';
import { InstallAppModal } from '@/components/InstallAppModal';
import { AndroidInstallBanner } from '@/components/AndroidInstallBanner';
import { ActiveStopwatchDock } from '@/components/ActiveStopwatchDock';
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
    importSummary,
    setImportSummary,
    sharingNote,
    setSharingNote,
  } = useKeep();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pendingNoteIdRef = useRef<string | null>(initialNoteId || null);

  // Read URL parameters on mount if no initialNoteId prop was passed
  useEffect(() => {
    if (typeof window === 'undefined') return;

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
    if (pendingNoteIdRef.current && !isLoading && notes.length > 0) {
      const targetId = pendingNoteIdRef.current;
      const found = notes.find((n) => n.id === targetId);
      if (found) {
        setEditingNote(found);
        pendingNoteIdRef.current = null;
      } else {
        // Target note was not found in local DB
        console.warn(`Note with ID ${targetId} not found in notes.`);
        pendingNoteIdRef.current = null;
      }
    }
  }, [notes, isLoading, setEditingNote]);

  // Synchronize editingNote with browser URL address bar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPath = window.location.pathname;

    if (editingNote) {
      const targetPath = `/note/${encodeURIComponent(editingNote.id)}`;
      if (currentPath !== targetPath) {
        window.history.pushState({ noteId: editingNote.id }, '', targetPath);
      }
      if (editingNote.title) {
        document.title = `${editingNote.title} - Keep Clone`;
      }
    } else {
      // When closed, if URL starts with /note/, revert cleanly to /
      if (currentPath.startsWith('/note/')) {
        window.history.pushState(null, '', '/');
        document.title = 'Google Keep Clone';
      }
    }
  }, [editingNote]);

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
          setEditingNote(target);
        } else {
          // If notes are loaded and not found, close modal
          setEditingNote(null);
        }
      } else {
        // Navigated back to home / or another route
        setEditingNote(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [notes, setEditingNote]);

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
      <div className="flex-1 flex">
        {/* Navigation Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          onOpenLabelModal={() => setIsLabelModalOpen(true)}
        />

        {/* Notes Feed Container */}
        <main className="flex-1 p-2.5 sm:p-4 md:p-8 overflow-y-auto max-w-[1600px] mx-auto w-full">
          {currentFilter === 'stats' ? (
            <ReadingStatsView />
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
                onSelectNote={(note) => setEditingNote(note)}
                onOpenDrawingModal={(noteId) => setIsDrawingModalOpen(true, noteId)}
              />
            </>
          )}
        </main>
      </div>

      {/* Full Note Editing Dialog */}
      <NoteModal
        note={editingNote}
        isOpen={!!editingNote}
        onClose={() => setEditingNote(null)}
        onOpenDrawingModal={(noteId) => setIsDrawingModalOpen(true, noteId)}
      />

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
    </div>
  );
}
