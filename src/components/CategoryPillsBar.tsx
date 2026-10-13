'use client';

import React from 'react';
import { Plus, Folder } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';

export const CategoryPillsBar: React.FC = () => {
  const {
    categories,
    notes,
    currentFilter,
    selectedCategory,
    setCurrentFilter,
    setIsCategoryModalOpen,
  } = useKeep();

  // Only show the category pills when on notes or category filter view
  if (currentFilter !== 'notes' && currentFilter !== 'category') {
    return null;
  }

  const isAllActive = currentFilter === 'notes';

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none select-none">
      {/* "All" Pill */}
      <button
        type="button"
        onClick={() => setCurrentFilter('notes')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-2xs ${
          isAllActive
            ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
            : 'bg-white dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700/60'
        }`}
      >
        <span>All Notes</span>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            isAllActive
              ? 'bg-white/20 text-white dark:bg-stone-900/20 dark:text-stone-900'
              : 'bg-black/5 dark:bg-white/10 text-stone-500'
          }`}
        >
          {notes.filter((n) => !n.isTrash && !n.isArchived).length}
        </span>
      </button>

      {/* Category Pills */}
      {categories.map((cat) => {
        const isActive = currentFilter === 'category' && selectedCategory === cat.name;
        const count = notes.filter((n) => n.category === cat.name && !n.isTrash && !n.isArchived).length;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCurrentFilter('category', cat.name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-2xs ${
              isActive
                ? 'shadow-xs'
                : 'bg-white dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700/60'
            }`}
            style={
              isActive
                ? {
                    backgroundColor: cat.color ? `${cat.color}25` : '#3b82f625',
                    color: cat.color || '#3b82f6',
                    borderColor: cat.color || '#3b82f6',
                    borderWidth: '1.5px',
                  }
                : undefined
            }
          >
            <span>{cat.icon || '📁'}</span>
            <span>{cat.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive
                  ? 'bg-black/10 dark:bg-white/10'
                  : 'bg-black/5 dark:bg-white/10 text-stone-500'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}

      {/* Add / Manage Categories Pill */}
      <button
        type="button"
        onClick={() => setIsCategoryModalOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 border border-dashed border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 whitespace-nowrap transition-colors"
        title="Manage Categories"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Categories</span>
      </button>
    </div>
  );
};
