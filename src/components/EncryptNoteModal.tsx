'use client';

import React, { useState } from 'react';
import { Lock, Unlock, KeyRound, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { Note } from '@/types/note';
import { encryptNote } from '@/lib/crypto';
import { lockNoteInSession } from '@/lib/encryptionSession';

interface EncryptNoteModalProps {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
  onEncrypted: (updatedNote: Partial<Note>, password?: string) => Promise<void>;
  onDecryptedPermanently?: () => Promise<void>;
}

export const EncryptNoteModal: React.FC<EncryptNoteModalProps> = ({
  note,
  isOpen,
  onClose,
  onEncrypted,
  onDecryptedPermanently,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState(note.encryptedData?.hint || '');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const isAlreadyEncrypted = !!note.isEncrypted;

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter an encryption password.');
      return;
    }
    if (password.length < 4) {
      setError('Password should be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsProcessing(true);
      const payload = {
        title: note.title,
        content: note.content,
        todos: note.todos,
        images: note.images,
      };

      const bundle = await encryptNote(payload, password, hint);

      // Lock note in session so user must enter password to unlock
      lockNoteInSession(note.id);

      await onEncrypted(
        {
          isEncrypted: true,
          encryptedData: bundle,
          // Mask plaintext in database storage
          content: '',
          todos: [],
          images: [],
        },
        password
      );

      onClose();
    } catch (err) {
      console.error('Failed to encrypt note:', err);
      setError(err instanceof Error ? err.message : 'Encryption failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecryptPermanently = async () => {
    if (!onDecryptedPermanently) return;
    try {
      setIsProcessing(true);
      await onDecryptedPermanently();
      onClose();
    } catch (err) {
      console.error('Failed to decrypt permanently:', err);
      setError('Failed to remove encryption.');
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
        className="w-full max-w-md bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/80 p-6 flex flex-col gap-4 text-stone-800 dark:text-stone-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              {isAlreadyEncrypted ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                {isAlreadyEncrypted ? 'Note Encryption Settings' : 'Encrypt Note'}
              </h3>
              <p className="text-xs text-stone-500">
                Client-side AES-256-GCM Zero-Knowledge encryption
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
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isAlreadyEncrypted ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              🔒 This note is currently protected with a password. Its content, title, checklists, and images are encrypted locally.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleDecryptPermanently}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800/50 transition-colors flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                Remove Encryption (Make note public)
              </button>

              <button
                type="button"
                onClick={() => {
                  lockNoteInSession(note.id);
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Lock Note Immediately
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEncrypt} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Encryption Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                Password Hint (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. My favorite dog from childhood"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <p className="text-[11px] text-stone-400 dark:text-stone-500 leading-normal">
              ⚠️ Note encryption happens entirely locally in your browser. There is no password recovery if you forget it.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
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
                {isProcessing ? 'Encrypting…' : 'Encrypt Note'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
