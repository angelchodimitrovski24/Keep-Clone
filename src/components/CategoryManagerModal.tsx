'use client';

import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Folder } from 'lucide-react';
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
  const { categories, notes, createCategory, updateCategory, deleteCategory } = useKeep();

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📁');
  const [editColor, setEditColor] = useState('#3b82f6');

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

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
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
                        <span className="text-[11px] text-stone-400 font-normal">
                          ({noteCount})
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
      </div>
    </div>
  );
};
