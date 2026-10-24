'use client';

import React, { useState } from 'react';
import { Tag, Trash2, Check, Plus, X, Pencil } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';

interface LabelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LabelManagerModal: React.FC<LabelManagerModalProps> = ({ isOpen, onClose }) => {
  const { labels, createLabel, deleteLabel, renameLabel } = useKeep();
  const [newLabelText, setNewLabelText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState('');

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (newLabelText.trim()) {
      await createLabel(newLabelText.trim());
      setNewLabelText('');
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditLabelText(name);
  };

  const handleSaveEdit = async (id: string, oldName: string) => {
    if (editLabelText.trim() && editLabelText.trim() !== oldName) {
      await renameLabel(id, oldName, editLabelText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#28292c] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-700 flex flex-col">
        <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-500" />
            Edit labels
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create new label input */}
        <div className="p-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2 px-3 py-2 bg-stone-100 dark:bg-stone-800/80 rounded-xl">
            <Plus className="w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Create new label..."
              value={newLabelText}
              onChange={(e) => setNewLabelText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400 dark:text-stone-200"
            />
            {newLabelText.trim() && (
              <button
                type="button"
                onClick={handleCreate}
                className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-md text-blue-600 dark:text-blue-400"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Labels list */}
        <div className="p-3 max-h-72 overflow-y-auto space-y-1">
          {labels.length === 0 ? (
            <p className="text-center text-xs text-stone-400 py-6">No labels yet. Create one above!</p>
          ) : (
            labels.map((lbl) => (
              <div
                key={lbl.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 group transition-colors"
              >
                {editingId === lbl.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editLabelText}
                      onChange={(e) => setEditLabelText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(lbl.id, lbl.name);
                        }
                      }}
                      autoFocus
                      className="flex-1 bg-white dark:bg-stone-700 px-2 py-1 rounded text-sm border border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(lbl.id, lbl.name)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200 truncate flex-1">
                      <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{lbl.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(lbl.id, lbl.name)}
                        className="p-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLabel(lbl.id, lbl.name)}
                        className="p-1 text-stone-400 hover:text-red-500 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-stone-50 dark:bg-[#202124] border-t border-stone-200 dark:border-stone-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-100 rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
