'use client';

import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Folder, Lock, Unlock, Shield, AlertCircle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { Category } from '@/types/note';

const PRESET_ICONS = ['📁', '💼', '👤', '💡', '💰', '🏠', '✈️', '🛒', '🎨', '💻', '⚡', '📌', '📚', '🎯', '🏋️', '🚀'];
const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ef4444', // Red
  '#64748b', // Slate
];

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    categories,
    notes,
    createCategory,
    updateCategory,
    deleteCategory,
    lockCategory,
    removeCategoryLock,
    isCategoryLocked,
    unlockedCategoryNames,
    unlockCategoryForSession,
    relockCategoryInSession,
  } = useKeep();

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📁');
  const [editColor, setEditColor] = useState('#3b82f6');

  // Category Lock Management state
  const [lockModalCat, setLockModalCat] = useState<Category | null>(null);
  const [lockView, setLockView] = useState<'overview' | 'set' | 'remove' | 'change'>('overview');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [hintInput, setHintInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [isProcessingLock, setIsProcessingLock] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createCategory(newName.trim(), newColor, newIcon);
    setNewName('');
    setNewIcon('📁');
    setNewColor('#3b82f6');
  };

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || '📁');
    setEditColor(cat.color || '#3b82f6');
  };

  const handleSaveEdit = async (cat: Category) => {
    if (!editName.trim()) return;
    await updateCategory(cat.id, {
      name: editName.trim(),
      icon: editIcon,
      color: editColor,
    });
    setEditingId(null);
  };

  const handleDelete = async (cat: Category) => {
    if (confirm(`Delete category "${cat.name}"? Notes will not be deleted, but will no longer have this category.`)) {
      await deleteCategory(cat.id, cat.name);
      if (editingId === cat.id) {
        setEditingId(null);
      }
    }
  };

  const openLockModal = (cat: Category) => {
    setLockModalCat(cat);
    setLockView(cat.isLocked ? 'overview' : 'set');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setHintInput(cat.lockHint || '');
    setLockError(null);
    setShowPassword(false);
  };

  const closeLockModal = () => {
    setLockModalCat(null);
    setLockError(null);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setHintInput('');
  };

  const handleSetLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockModalCat) return;
    if (!newPasswordInput) {
      setLockError('Password cannot be empty');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setLockError('Passwords do not match');
      return;
    }

    try {
      setIsProcessingLock(true);
      setLockError(null);
      await lockCategory(lockModalCat.id, newPasswordInput, hintInput);
      closeLockModal();
    } catch {
      setLockError('Failed to lock category.');
    } finally {
      setIsProcessingLock(false);
    }
  };

  const handleRemoveLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockModalCat) return;
    if (!currentPasswordInput) {
      setLockError('Current password is required');
      return;
    }

    try {
      setIsProcessingLock(true);
      setLockError(null);
      const success = await removeCategoryLock(lockModalCat.id, currentPasswordInput);
      if (!success) {
        setLockError('Incorrect password. Please try again.');
        return;
      }
      closeLockModal();
    } catch {
      setLockError('Failed to remove lock.');
    } finally {
      setIsProcessingLock(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockModalCat) return;
    if (!currentPasswordInput) {
      setLockError('Current password is required');
      return;
    }
    if (!newPasswordInput) {
      setLockError('New password cannot be empty');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setLockError('New passwords do not match');
      return;
    }

    try {
      setIsProcessingLock(true);
      setLockError(null);
      const removed = await removeCategoryLock(lockModalCat.id, currentPasswordInput);
      if (!removed) {
        setLockError('Incorrect current password.');
        return;
      }
      await lockCategory(lockModalCat.id, newPasswordInput, hintInput);
      closeLockModal();
    } catch {
      setLockError('Failed to change password.');
    } finally {
      setIsProcessingLock(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 relative"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Manage Categories
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Create New Category Form */}
          <form onSubmit={handleCreate} className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200/80 dark:border-stone-800 space-y-3">
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Add New Category
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xl select-none w-8 text-center">{newIcon}</span>
              <input
                type="text"
                placeholder="Category name (e.g. Work, Finance)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Icon Picker Chips */}
            <div className="space-y-1">
              <div className="text-[11px] text-stone-500 dark:text-stone-400">Choose Icon:</div>
              <div className="flex flex-wrap gap-1">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewIcon(icon)}
                    className={`w-7 h-7 rounded-md text-sm flex items-center justify-center transition-all ${
                      newIcon === icon
                        ? 'bg-amber-100 dark:bg-amber-950/80 ring-2 ring-amber-500 scale-110'
                        : 'hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Swatches */}
            <div className="space-y-1">
              <div className="text-[11px] text-stone-500 dark:text-stone-400">Choose Color:</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newColor === c ? 'ring-2 ring-offset-2 ring-stone-900 dark:ring-stone-100 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Categories List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Existing Categories ({categories.length})
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-6 text-stone-400 text-sm">
                No categories yet. Create your first category above!
              </div>
            ) : (
              <div className="space-y-1.5">
                {categories.map((cat) => {
                  const noteCount = notes.filter((n) => n.category === cat.name && !n.isTrash).length;
                  const isEditing = editingId === cat.id;

                  if (isEditing) {
                    return (
                      <div
                        key={cat.id}
                        className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 rounded-xl space-y-2.5 animate-in fade-in duration-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg w-7 text-center">{editIcon}</span>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(cat);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-2.5 py-1 text-sm bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg outline-none text-stone-900 dark:text-stone-100"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat)}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            title="Save changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Edit Icon */}
                        <div className="flex flex-wrap gap-1">
                          {PRESET_ICONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => setEditIcon(icon)}
                              className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                                editIcon === icon ? 'bg-amber-200 dark:bg-amber-900 ring-1 ring-amber-500' : 'hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>

                        {/* Edit Color */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              className={`w-5 h-5 rounded-full ${
                                editColor === c ? 'ring-2 ring-stone-900 dark:ring-stone-100 scale-110' : ''
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }

                  const isLocked = !!cat.isLocked;
                  const isUnlocked = unlockedCategoryNames.includes(cat.name.toLowerCase());

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800/60 border border-stone-200/50 dark:border-stone-800/60 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{cat.icon || '📁'}</span>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || '#3b82f6' }}
                        />
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate">
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-stone-400 font-normal shrink-0">
                          ({noteCount})
                        </span>
                        {isLocked && (
                          <span
                            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                              isUnlocked
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                            }`}
                            title={isUnlocked ? 'Unlocked in current session' : 'Locked with password'}
                          >
                            {isUnlocked ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                            <span>{isUnlocked ? 'Unlocked' : 'Locked'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openLockModal(cat)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isLocked
                              ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                          }`}
                          title={isLocked ? 'Manage category lock / password' : 'Lock category with password'}
                        >
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 transition-colors"
                          title="Edit category"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 transition-colors"
                          title="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 flex justify-end bg-stone-50/50 dark:bg-stone-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            Done
          </button>
        </div>

        {/* Sub-Modal: Lock Management Overlay */}
        {lockModalCat && (
          <div
            onClick={closeLockModal}
            className="absolute inset-0 z-10 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-[#202124] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 p-5 space-y-4 animate-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                    style={{
                      backgroundColor: lockModalCat.color ? `${lockModalCat.color}20` : 'rgba(245, 158, 11, 0.15)',
                      color: lockModalCat.color || '#f59e0b',
                    }}
                  >
                    {lockModalCat.icon || '📁'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span>{lockModalCat.isLocked ? 'Category Security' : 'Lock Category'}</span>
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      &quot;{lockModalCat.name}&quot;
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeLockModal}
                  className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Banner */}
              {lockError && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{lockError}</span>
                </div>
              )}

              {/* VIEW: Set Lock */}
              {lockView === 'set' && (
                <form onSubmit={handleSetLockSubmit} className="space-y-3">
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Set a password to lock this category. Notes in this category will be protected and hidden until unlocked.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="Enter password"
                          className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100 pr-8"
                          autoFocus
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        Password Hint (Optional)
                      </label>
                      <input
                        type="text"
                        value={hintInput}
                        onChange={(e) => setHintInput(e.target.value)}
                        placeholder="e.g. My childhood pet"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={closeLockModal}
                      className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingLock || !newPasswordInput}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {isProcessingLock ? 'Locking...' : 'Lock Category'}
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW: Overview (When already locked) */}
              {lockView === 'overview' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                        <Shield className="w-4 h-4 text-amber-500" />
                        <span>Status: Password Protected</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          unlockedCategoryNames.includes(lockModalCat.name.toLowerCase())
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        {unlockedCategoryNames.includes(lockModalCat.name.toLowerCase())
                          ? 'Unlocked in Session'
                          : 'Locked'}
                      </span>
                    </div>

                    {lockModalCat.lockHint && (
                      <p className="text-[11px] text-stone-600 dark:text-stone-400">
                        <span className="font-medium text-stone-700 dark:text-stone-300">Hint:</span>{' '}
                        {lockModalCat.lockHint}
                      </p>
                    )}

                    {/* Quick session re-lock or unlock */}
                    {unlockedCategoryNames.includes(lockModalCat.name.toLowerCase()) ? (
                      <button
                        type="button"
                        onClick={() => {
                          relockCategoryInSession(lockModalCat.name);
                        }}
                        className="w-full mt-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Re-lock category now
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLockView('change');
                        setLockError(null);
                        setCurrentPasswordInput('');
                        setNewPasswordInput('');
                        setConfirmPasswordInput('');
                      }}
                      className="w-full px-3 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-stone-400" />
                      Change Password
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLockView('remove');
                        setLockError(null);
                        setCurrentPasswordInput('');
                      }}
                      className="w-full px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Unlock className="w-3.5 h-3.5 text-red-500" />
                      Remove Password Protection
                    </button>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={closeLockModal}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW: Remove Lock */}
              {lockView === 'remove' && (
                <form onSubmit={handleRemoveLockSubmit} className="space-y-3">
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Enter the current password to completely remove lock protection from &quot;{lockModalCat.name}&quot;.
                  </p>

                  <div>
                    <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-red-500 text-stone-900 dark:text-stone-100 pr-8"
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => {
                        setLockView('overview');
                        setLockError(null);
                      }}
                      className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingLock || !currentPasswordInput}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      {isProcessingLock ? 'Removing...' : 'Remove Lock'}
                    </button>
                  </div>
                </form>
              )}

              {/* VIEW: Change Password */}
              {lockView === 'change' && (
                <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        Current Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100"
                        autoFocus
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100 pr-8"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300 block mb-1">
                        New Password Hint (Optional)
                      </label>
                      <input
                        type="text"
                        value={hintInput}
                        onChange={(e) => setHintInput(e.target.value)}
                        placeholder="Hint for new password"
                        className="w-full px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg outline-none focus:border-amber-500 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => {
                        setLockView('overview');
                        setLockError(null);
                      }}
                      className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingLock || !newPasswordInput || !currentPasswordInput}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isProcessingLock ? 'Updating...' : 'Save Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
