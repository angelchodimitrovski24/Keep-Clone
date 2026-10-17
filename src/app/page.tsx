'use client';

import React, { useState } from 'react';
import { KeepProvider, useKeep } from '@/context/KeepContext';
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
import { Note, NoteDrawing } from '@/types/note';

function KeepApp() {
  const {
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
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-[1600px] mx-auto w-full">
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

      {/* Share Note Modal with Short Link */}
      <ShareNoteModal
        note={sharingNote}
        isOpen={!!sharingNote}
        onClose={() => setSharingNote(null)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <KeepProvider>
      <KeepApp />
    </KeepProvider>
  );
}
