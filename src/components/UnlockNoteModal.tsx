'use client';

import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { Note } from '@/types/note';
import { decryptNote, DecryptedNotePayload } from '@/lib/crypto';
import { setUnlockedNote } from '@/lib/encryptionSession';

interface UnlockNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: (note: Note, decryptedData: DecryptedNotePayload) => void;
}

export const UnlockNoteModal: React.FC<UnlockNoteModalProps> = ({
  note,
  isOpen,
  onClose,
  onUnlocked,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !note || !note.encryptedData) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter the password.');
      return;
    }

    if (!note.encryptedData) {
      setError('Encrypted note data is missing.');
      return;
    }

    try {
      setIsProcessing(true);
      const decrypted = await decryptNote(note.encryptedData, password);

      // Cache decrypted payload in current session
      setUnlockedNote(note.id, decrypted);

      const restoredNote: Note = {
        ...note,
        title: decrypted.title || note.title,
        content: decrypted.content || '',
        todos: decrypted.todos || note.todos || [],
        images: decrypted.images || note.images || [],
      };

      onUnlocked(restoredNote, decrypted);
      setPassword('');
      onClose();
    } catch {
      setError('Incorrect password. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/80 p-6 flex flex-col gap-4 text-stone-800 dark:text-stone-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                Unlock Note
              </h3>
              <p className="text-xs text-stone-500">
                {note.title ? `"${note.title}"` : 'Encrypted Note'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {note.encryptedData?.hint && (
          <div className="flex items-start gap-2 p-3 text-xs rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-semibold">Hint: </span>
              <span>{note.encryptedData.hint}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
              Enter Password
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 outline-none focus:ring-2 focus:ring-amber-500"
              />
              <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              {isProcessing ? 'Unlocking…' : 'Unlock Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
