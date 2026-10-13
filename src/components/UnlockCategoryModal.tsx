'use client';

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X, KeyRound, AlertCircle, Shield } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';

export const UnlockCategoryModal: React.FC = () => {
  const {
    unlockCategoryModalTarget,
    setUnlockCategoryModalTarget,
    unlockCategoryForSession,
  } = useKeep();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!unlockCategoryModalTarget) return null;

  const category = unlockCategoryModalTarget;

  const handleClose = () => {
    setPassword('');
    setError(null);
    setUnlockCategoryModalTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const success = await unlockCategoryForSession(category.name, password);
      if (success) {
        handleClose();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Failed to verify password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-2xs"
              style={{
                backgroundColor: category.color ? `${category.color}20` : 'rgba(59, 130, 246, 0.15)',
                color: category.color || '#3b82f6',
              }}
            >
              {category.icon || '📁'}
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>Unlock Category</span>
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                &quot;{category.name}&quot; is password protected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Password Hint */}
        {category.lockHint && (
          <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <KeyRound className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              <strong>Password Hint:</strong> {category.lockHint}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter category password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
              className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl outline-none focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Verifying…' : 'Unlock Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
