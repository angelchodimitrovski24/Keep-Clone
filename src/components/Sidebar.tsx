'use client';

import React from 'react';
import {
  Lightbulb,
  Bell,
  Tag,
  Pencil,
  Archive,
  Trash2,
  X,
  Settings as SettingsIcon,
  Folder,
  Lock,
  Unlock,
  BarChart2,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import { ViewFilter } from '@/types/note';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile?: () => void;
  onOpenLabelModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onCloseMobile,
  onOpenLabelModal,
}) => {
  const {
    currentFilter,
    selectedLabel,
    selectedCategory,
    setCurrentFilter,
    labels,
    categories,
    unlockedCategoryNames,
    setIsCategoryModalOpen,
    setIsSettingsOpen,
  } = useKeep();

  const navItems: { id: ViewFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'notes', label: 'Notes', icon: <Lightbulb className="w-5 h-5" /> },
    { id: 'reminders', label: 'Reminders', icon: <Bell className="w-5 h-5" /> },
    { id: 'archive', label: 'Archive', icon: <Archive className="w-5 h-5" /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 className="w-5 h-5" /> },
    { id: 'stats', label: 'Reading Stats', icon: <BarChart2 className="w-5 h-5" /> },
  ];

  const handleSelectNav = (id: ViewFilter, labelName?: string) => {
    setCurrentFilter(id, labelName);
    if (window.innerWidth < 1024) {
      onCloseMobile?.();
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden animate-in fade-in duration-150"
        />
      )}

      <aside
        className={`fixed lg:static top-16 left-0 bottom-0 z-40 transition-all duration-200 bg-white dark:bg-[#202124] overflow-y-auto select-none border-r border-stone-200 dark:border-stone-800 py-4 ${
          isOpen
            ? 'w-72 sm:w-64 px-3 translate-x-0 shadow-2xl lg:shadow-none'
            : '-translate-x-full lg:translate-x-0 lg:w-18 px-2'
        }`}
      >
        <div className="flex flex-col gap-1">
          {/* Main tabs */}
          {navItems.map((item) => {
            const isActive = currentFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`flex items-center gap-5 px-4 py-3 rounded-r-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-100 text-stone-900 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                title={item.label}
              >
                <span className={`shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                  {item.icon}
                </span>
                <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          <div className="my-2 border-t border-stone-200 dark:border-stone-800" />

          {/* Categories section */}
          {isOpen && (
            <div className="px-4 py-1 text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center justify-between">
              <span>Categories</span>
            </div>
          )}

          {categories.map((cat) => {
            const isActive = currentFilter === 'category' && selectedCategory === cat.name;
            const isLocked = !!cat.isLocked;
            const isUnlocked = unlockedCategoryNames.includes(cat.name.toLowerCase());

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectNav('category', cat.name)}
                className={`flex items-center gap-5 px-4 py-2.5 rounded-r-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-100 text-stone-900 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                title={cat.name}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center text-base">
                  {cat.icon || '📁'}
                </span>
                <span className={`truncate flex-1 flex items-center justify-between ${isOpen ? 'inline-flex' : 'hidden lg:hidden'}`}>
                  <span className="truncate">{cat.name}</span>
                  {isLocked && (
                    <span className="shrink-0 ml-1.5" title={isUnlocked ? 'Unlocked in session' : 'Password protected'}>
                      {isUnlocked ? (
                        <Unlock className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {/* Edit Categories Button */}
          <button
            type="button"
            onClick={() => {
              setIsCategoryModalOpen(true);
              if (window.innerWidth < 1024) {
                onCloseMobile?.();
              }
            }}
            className="flex items-center gap-5 px-4 py-2.5 rounded-r-full text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Edit categories"
          >
            <Folder className="w-5 h-5 shrink-0 text-stone-400" />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Edit categories
            </span>
          </button>

          <div className="my-2 border-t border-stone-200 dark:border-stone-800" />

          {/* Labels section */}
          {isOpen && (
            <div className="px-4 py-1 text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Labels
            </div>
          )}

          {labels.map((lbl) => {
            const isActive = currentFilter === 'label' && selectedLabel === lbl.name;
            return (
              <button
                key={lbl.id}
                type="button"
                onClick={() => handleSelectNav('label', lbl.name)}
                className={`flex items-center gap-5 px-4 py-2.5 rounded-r-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-100 text-stone-900 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
                title={lbl.name}
              >
                <Tag className={`w-5 h-5 shrink-0 ${isActive ? 'text-amber-600' : 'text-stone-400'}`} />
                <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
                  {lbl.name}
                </span>
              </button>
            );
          })}

          {/* Edit Labels Button */}
          <button
            type="button"
            onClick={() => {
              onOpenLabelModal();
              if (window.innerWidth < 1024) {
                onCloseMobile?.();
              }
            }}
            className="flex items-center gap-5 px-4 py-2.5 rounded-r-full text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Edit labels"
          >
            <Pencil className="w-5 h-5 shrink-0 text-stone-400" />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Edit labels
            </span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              setIsSettingsOpen(true);
              if (window.innerWidth < 1024) {
                onCloseMobile?.();
              }
            }}
            className="flex items-center gap-5 px-4 py-2.5 rounded-r-full text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5 shrink-0 text-stone-400" />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Settings
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
