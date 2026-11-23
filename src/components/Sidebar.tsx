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
  Smartphone,
  CalendarRange,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Users,
  Inbox,
  Compass,
  Home,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
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
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

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
    setIsInstallModalOpen,
    promptInstallPwa,
    canInstallPwa,
    isPwaInstalled,
    setIsDateCompileModalOpen,
    setEditingNote,
    unconnectedCount,
    hubTrees,
    layoutMode,
    setLayoutMode,
    openInKnowledgeMap,
    addNote,
    connectNotes,
  } = useKeep();

  const [expandedHubIds, setExpandedHubIds] = React.useState<Record<string, boolean>>({});
  const [isCreatingHub, setIsCreatingHub] = React.useState(false);
  const [newHubTitle, setNewHubTitle] = React.useState('');

  const toggleHubExpanded = (hubId: string) => {
    setExpandedHubIds((prev) => ({ ...prev, [hubId]: !prev[hubId] }));
  };

  const handleQuickCreateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHubTitle.trim();
    if (!trimmed) return;
    const created = await addNote({
      title: trimmed,
      content: `## 🏠 ${trimmed} Hub\n\nCentral index note for ${trimmed}. Add sub-pages below or type \`[[\` to connect related notes.`,
      isHub: true,
      noteType: 'notion',
    });
    setNewHubTitle('');
    setIsCreatingHub(false);
    if (created) {
      setExpandedHubIds((prev) => ({ ...prev, [created.id]: true }));
      setEditingNote(created);
    }
  };

  const handleQuickCreateChild = async (hubId: string, hubCategory?: string | null) => {
    const created = await addNote({
      title: 'Untitled Page',
      content: '',
      parentNoteId: hubId,
      category: hubCategory || null,
      noteType: 'notion',
    });
    if (created) {
      await connectNotes(created.id, hubId, 'part_of');
      setExpandedHubIds((prev) => ({ ...prev, [hubId]: true }));
      setEditingNote(created);
    }
  };

  const navItems: { id: ViewFilter; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'notes', label: 'Notes', icon: <Lightbulb className="w-5 h-5" /> },
    { id: 'unconnected', label: 'Unconnected', icon: <Inbox className="w-5 h-5" />, badge: unconnectedCount },
    { id: 'psi', label: 'PSI Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'team', label: 'Team Dashboard', icon: <Users className="w-5 h-5" /> },
    { id: 'reminders', label: 'Reminders', icon: <Bell className="w-5 h-5" /> },
    { id: 'calendar', label: 'Calendar', icon: <CalendarIcon className="w-5 h-5" /> },
    { id: 'archive', label: 'Archive', icon: <Archive className="w-5 h-5" /> },
    { id: 'trash', label: 'Trash', icon: <Trash2 className="w-5 h-5" /> },
    { id: 'stats', label: 'Reading Stats', icon: <BarChart2 className="w-5 h-5" /> },
  ];

  const handleSelectNav = (id: ViewFilter, labelName?: string) => {
    setEditingNote(null);
    if (id === 'notes' && layoutMode === 'map') {
      setLayoutMode('grid');
    }
    setCurrentFilter(id, labelName);
    if (typeof window !== 'undefined') {
      if (id === 'calendar') {
        window.history.pushState(null, '', '/calendar');
      } else if (id === 'stats') {
        window.history.pushState(null, '', '/stats');
      } else if (id === 'psi') {
        window.history.pushState(null, '', '/psi');
      } else if (id === 'team') {
        window.history.pushState(null, '', '/team');
      } else if (window.location.pathname === '/stats' || window.location.pathname === '/calendar' || window.location.pathname === '/psi' || window.location.pathname === '/team') {
        window.history.pushState(null, '', '/');
      }
    }
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
        className={`fixed lg:static top-16 left-0 bottom-0 z-40 lg:h-full lg:min-h-0 lg:shrink-0 transition-all duration-200 bg-[#f8f8f7] dark:bg-[#202124] overflow-y-auto overscroll-contain select-none border-r border-black/[0.06] dark:border-white/[0.06] py-3 ${
          isOpen
            ? 'w-72 sm:w-64 px-2.5 translate-x-0 shadow-2xl lg:shadow-none'
            : '-translate-x-full lg:translate-x-0 lg:w-16 px-2'
        }`}
      >
        <div className="flex flex-col gap-0.5">
          {/* Main tabs */}
          {navItems.map((item) => {
            const isActive =
              currentFilter === item.id && !(item.id === 'notes' && layoutMode === 'map');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
                  isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
                } ${
                  isActive
                    ? 'bg-black/[0.06] text-stone-900 font-semibold dark:bg-white/[0.09] dark:text-stone-100'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
                title={item.label}
              >
                <span className={`shrink-0 ${isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>
                  {item.icon}
                </span>
                <span className={`truncate flex-1 flex items-center justify-between ${isOpen ? 'inline-flex' : 'hidden lg:hidden'}`}>
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-black/[0.06] dark:bg-white/[0.08] text-stone-500 dark:text-stone-400">
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {/* Knowledge Map quick entry */}
          <button
            type="button"
            onClick={() => {
              openInKnowledgeMap(null);
              if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                window.history.pushState(null, '', '/');
              }
              if (window.innerWidth < 1024) {
                onCloseMobile?.();
              }
            }}
            className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
              isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
            } ${
              currentFilter === 'notes' && layoutMode === 'map'
                ? 'bg-amber-500/12 text-amber-900 font-semibold dark:bg-amber-500/20 dark:text-amber-200'
                : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
            }`}
            title="Open Visual Knowledge Map"
          >
            <Compass className={`w-4 h-4 shrink-0 ${currentFilter === 'notes' && layoutMode === 'map' ? 'text-amber-500' : 'text-stone-500 dark:text-stone-400'}`} />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Knowledge Map
            </span>
          </button>

          {/* Create Note from Date Range */}
          <button
            type="button"
            onClick={() => {
              setIsDateCompileModalOpen(true);
              if (window.innerWidth < 1024) {
                onCloseMobile?.();
              }
            }}
            className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer ${
              isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
            }`}
            title="Create note from date range (today, 7d, 14d, 30d...)"
          >
            <CalendarRange className="w-4 h-4 shrink-0 text-stone-500 dark:text-stone-400" />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Notes by Date Range
            </span>
          </button>

          <div className="my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />

          {/* Knowledge Hubs Tree section */}
          {isOpen && (
            <div className="px-2.5 py-1 text-[11px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Home className="w-3 h-3 text-stone-400" />
                <span>Knowledge Hubs</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingHub(!isCreatingHub)}
                className="p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                title="Create a new Knowledge Hub"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isOpen && isCreatingHub && (
            <form onSubmit={handleQuickCreateHub} className="px-3 py-1 flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={newHubTitle}
                onChange={(e) => setNewHubTitle(e.target.value)}
                placeholder="New Hub title..."
                className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 border border-amber-500/40 outline-none"
              />
              <button
                type="submit"
                className="px-2 py-1 rounded-lg bg-amber-500 text-stone-950 text-[11px] font-semibold cursor-pointer"
              >
                Add
              </button>
            </form>
          )}

          {isMounted && isOpen && hubTrees.length === 0 && !isCreatingHub && (
            <div className="px-2.5 py-1 text-[11px] text-stone-400 dark:text-stone-500 leading-snug">
              Pin any note as a <strong className="text-stone-600 dark:text-stone-300">Hub</strong> for your tree.
            </div>
          )}

          {isMounted && hubTrees.map(({ hub, children }) => {
            const isExpanded = Boolean(expandedHubIds[hub.id]);
            return (
              <div key={hub.id} className="flex flex-col">
                <div className="group flex items-center gap-0.5 pr-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors">
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => toggleHubExpanded(hub.id)}
                      className="p-1 ml-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer shrink-0"
                      title={isExpanded ? 'Collapse Hub' : 'Expand Hub sub-pages'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNote(hub);
                      if (window.innerWidth < 1024) onCloseMobile?.();
                    }}
                    className={`flex-1 min-w-0 flex items-center gap-2.5 py-1.5 text-[13.5px] font-medium text-stone-600 dark:text-stone-300 text-left cursor-pointer ${
                      isOpen ? 'px-1' : 'px-2 justify-center'
                    }`}
                    title={hub.title || 'Untitled Hub'}
                  >
                    <span className="shrink-0 text-sm">🏠</span>
                    <span className={`truncate flex-1 ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
                      {hub.title || 'Untitled Hub'}
                    </span>
                    {isOpen && children.length > 0 && (
                      <span className="text-[10px] font-mono text-stone-400 shrink-0">
                        {children.length}
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handleQuickCreateChild(hub.id, hub.category)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-amber-500/20 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-opacity cursor-pointer shrink-0"
                      title={`New sub-page inside "${hub.title || 'Hub'}"`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isOpen && isExpanded && (
                  <div className="pl-6 pr-1.5 space-y-0.5 border-l border-black/[0.06] dark:border-white/[0.07] ml-4 my-0.5">
                    {children.length > 0 ? (
                      children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            setEditingNote(child);
                            if (window.innerWidth < 1024) onCloseMobile?.();
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[12.5px] text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
                          title={child.title || 'Untitled Page'}
                        >
                          <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">{child.title || 'Untitled Page'}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-[11px] text-stone-400 italic">
                        No sub-pages yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />

          {/* Categories section */}
          {isOpen && (
            <div className="px-2.5 py-1 text-[11px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider flex items-center justify-between">
              <span>Categories</span>
            </div>
          )}

          {isMounted && categories.map((cat) => {
            const isActive = currentFilter === 'category' && selectedCategory === cat.name;
            const isLocked = !!cat.isLocked;
            const isUnlocked = unlockedCategoryNames.includes(cat.name.toLowerCase());

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectNav('category', cat.name)}
                className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
                  isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
                } ${
                  isActive
                    ? 'bg-black/[0.06] text-stone-900 font-semibold dark:bg-white/[0.09] dark:text-stone-100'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
                title={cat.name}
              >
                <span className="w-4 h-4 shrink-0 flex items-center justify-center text-sm">
                  {cat.icon || '📁'}
                </span>
                <span className={`truncate flex-1 flex items-center justify-between ${isOpen ? 'inline-flex' : 'hidden lg:hidden'}`}>
                  <span className="truncate">{cat.name}</span>
                  {isLocked && (
                    <span className="shrink-0 ml-1.5" title={isUnlocked ? 'Unlocked in session' : 'Password protected'}>
                      {isUnlocked ? (
                        <Unlock className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
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
            className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer ${
              isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
            }`}
            title="Edit categories"
          >
            <Folder className="w-4 h-4 shrink-0 text-stone-400" />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Edit categories
            </span>
          </button>

          <div className="my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />

          {/* Labels section */}
          {isOpen && (
            <div className="px-2.5 py-1 text-[11px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
              Labels
            </div>
          )}

          {isMounted && labels.map((lbl) => {
            const isActive = currentFilter === 'label' && selectedLabel === lbl.name;
            return (
              <button
                key={lbl.id}
                type="button"
                onClick={() => handleSelectNav('label', lbl.name)}
                className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
                  isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
                } ${
                  isActive
                    ? 'bg-black/[0.06] text-stone-900 font-semibold dark:bg-white/[0.09] dark:text-stone-100'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
                title={lbl.name}
              >
                <Tag className={`w-4 h-4 shrink-0 ${isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`} />
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
            className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer ${
              isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
            }`}
            title="Edit labels"
          >
            <Pencil className="w-4 h-4 shrink-0 text-stone-400" />
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
            className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer ${
              isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
            }`}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4 shrink-0 text-stone-400" />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              Settings
            </span>
          </button>

          {/* Install on Android Button */}
          <button
            type="button"
            onClick={() => {
              if (canInstallPwa) {
                promptInstallPwa();
              } else {
                setIsInstallModalOpen(true);
              }
              if (window.innerWidth < 1024) {
                onCloseMobile?.();
              }
            }}
            className={`flex items-center py-1.5 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
              isOpen ? 'gap-3 px-2.5' : 'justify-center px-2'
            } ${
              isPwaInstalled
                ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
            }`}
            title={isPwaInstalled ? 'App is installed on device' : 'Install on Android (PWA)'}
          >
            <Smartphone className={`w-4 h-4 shrink-0 ${isPwaInstalled ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`} />
            <span className={`truncate ${isOpen ? 'inline' : 'hidden lg:hidden'}`}>
              {isPwaInstalled ? 'App Installed ✓' : 'Install on Android'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
