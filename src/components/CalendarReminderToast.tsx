'use client';

import React from 'react';
import { useKeep } from '@/context/KeepContext';
import { Bell, X, Calendar as CalendarIcon, CheckSquare, FileText } from 'lucide-react';

export const CalendarReminderToast: React.FC = () => {
  const { activeReminderNotices, dismissReminderNotice, setEditingNote, notes, setCurrentFilter } = useKeep();

  if (!activeReminderNotices || activeReminderNotices.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {activeReminderNotices.map((notice) => {
        const icon =
          notice.itemType === 'event' ? (
            <CalendarIcon className="w-5 h-5 text-blue-500" />
          ) : notice.itemType === 'task' ? (
            <CheckSquare className="w-5 h-5 text-emerald-500" />
          ) : (
            <FileText className="w-5 h-5 text-amber-500" />
          );

        const handleClick = () => {
          dismissReminderNotice(notice.id);
          if (notice.itemType === 'note') {
            const foundNote = notes.find((n) => n.id === notice.itemId);
            if (foundNote) {
              setEditingNote(foundNote);
            }
          } else {
            setCurrentFilter('calendar');
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/calendar');
            }
          }
        };

        return (
          <div
            key={notice.id}
            className="pointer-events-auto bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 rounded-2xl p-4 shadow-2xl border border-stone-200 dark:border-stone-700 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200 transition-all hover:scale-[1.02] cursor-pointer"
            onClick={handleClick}
          >
            <div
              className="p-2 rounded-xl shrink-0"
              style={{ backgroundColor: `${notice.color || '#039be5'}20` }}
            >
              {icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                <Bell className="w-3 h-3 text-amber-500" />
                <span>
                  {notice.itemType === 'event'
                    ? 'Upcoming Event'
                    : notice.itemType === 'task'
                    ? 'Task Due'
                    : 'Note Reminder'}
                </span>
                <span className="ml-auto text-[11px] font-normal normal-case">
                  {notice.timeStr}
                </span>
              </div>
              <h4 className="text-sm font-semibold truncate mt-0.5 text-stone-900 dark:text-stone-100">
                {notice.title}
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Click to view in {notice.itemType === 'note' ? 'notes' : 'calendar'}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissReminderNotice(notice.id);
              }}
              className="p-1 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
