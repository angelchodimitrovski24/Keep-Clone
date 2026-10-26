'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  AlignLeft,
  Bell,
  Trash2,
  Check,
  CheckSquare,
} from 'lucide-react';
import {
  CalendarItem,
  CalendarEvent,
  CalendarTask,
  GOOGLE_CALENDAR_COLORS,
  REMINDER_OPTIONS,
} from '@/types/calendar';

interface CalendarItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: CalendarItem | null;
  initialDate?: string; // YYYY-MM-DD
  initialHour?: number;
  onSave: (itemData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const CalendarItemModal: React.FC<CalendarItemModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  initialDate,
  initialHour,
  onSave,
  onDelete,
}) => {
  const [itemType, setItemType] = useState<'event' | 'task'>('event');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(GOOGLE_CALENDAR_COLORS[0].hex);
  const [location, setLocation] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number>(15);

  // Event specific
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);

  // Task specific
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultDateStr = initialDate || `${yyyy}-${mm}-${dd}`;

    const defaultStartHour = initialHour !== undefined ? String(initialHour).padStart(2, '0') : '09';
    const defaultEndHour =
      initialHour !== undefined ? String(Math.min(23, initialHour + 1)).padStart(2, '0') : '10';

    if (itemToEdit) {
      setItemType(itemToEdit.type);
      setTitle(itemToEdit.title);
      setDescription(itemToEdit.description || '');
      setColor(itemToEdit.color || GOOGLE_CALENDAR_COLORS[0].hex);
      setReminderMinutes(
        itemToEdit.reminderMinutes !== undefined ? itemToEdit.reminderMinutes : -1
      );

      if (itemToEdit.type === 'event') {
        const ev = itemToEdit as CalendarEvent;
        setStartDate(ev.startDate);
        setStartTime(ev.startTime || '09:00');
        setEndDate(ev.endDate || ev.startDate);
        setEndTime(ev.endTime || '10:00');
        setIsAllDay(ev.isAllDay);
        setLocation(ev.location || '');
      } else {
        const tsk = itemToEdit as CalendarTask;
        setDueDate(tsk.dueDate);
        setDueTime(tsk.dueTime || '12:00');
        setIsCompleted(tsk.isCompleted);
      }
    } else {
      // New item
      setItemType('event');
      setTitle('');
      setDescription('');
      setColor(GOOGLE_CALENDAR_COLORS[0].hex);
      setLocation('');
      setReminderMinutes(15);

      setStartDate(defaultDateStr);
      setStartTime(`${defaultStartHour}:00`);
      setEndDate(defaultDateStr);
      setEndTime(`${defaultEndHour}:00`);
      setIsAllDay(false);

      setDueDate(defaultDateStr);
      setDueTime(`${defaultStartHour}:00`);
      setIsCompleted(false);
    }
  }, [isOpen, itemToEdit, initialDate, initialHour]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim() || (itemType === 'event' ? '(No title)' : 'Untitled task');

    if (itemType === 'event') {
      const eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'event',
        title: trimmedTitle,
        description: description.trim() || undefined,
        startDate: startDate || new Date().toISOString().slice(0, 10),
        startTime: isAllDay ? undefined : startTime,
        endDate: endDate || startDate || new Date().toISOString().slice(0, 10),
        endTime: isAllDay ? undefined : endTime,
        isAllDay,
        color,
        location: location.trim() || undefined,
        reminderMinutes: reminderMinutes >= 0 ? reminderMinutes : undefined,
      };
      await onSave(eventData);
    } else {
      const taskData: Omit<CalendarTask, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'task',
        title: trimmedTitle,
        description: description.trim() || undefined,
        dueDate: dueDate || new Date().toISOString().slice(0, 10),
        dueTime: dueTime || undefined,
        isCompleted,
        color: color || '#0b8043',
        reminderMinutes: reminderMinutes >= 0 ? reminderMinutes : undefined,
      };
      await onSave(taskData);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (itemToEdit && onDelete) {
      if (window.confirm(`Delete this ${itemToEdit.type}?`)) {
        await onDelete(itemToEdit.id);
        onClose();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header / Tab Bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            {!itemToEdit && (
              <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setItemType('event');
                    setColor(GOOGLE_CALENDAR_COLORS[0].hex);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    itemType === 'event'
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemType('task');
                    setColor('#0b8043');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    itemType === 'task'
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Task
                </button>
              </div>
            )}
            {itemToEdit && (
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-semibold capitalize">
                  Edit {itemToEdit.type}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {itemToEdit && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 text-stone-500 hover:text-red-600 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Title Input */}
          <div>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={itemType === 'event' ? 'Add title' : 'Add title'}
              className="w-full text-xl sm:text-2xl font-semibold bg-transparent border-b-2 border-stone-200 dark:border-stone-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none pb-1.5 transition-colors placeholder:text-stone-400"
            />
          </div>

          {/* EVENT: Date & Time Picker */}
          {itemType === 'event' && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Clock className="w-4 h-4 shrink-0 text-blue-500" />
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium outline-none"
                  />
                  {!isAllDay && (
                    <>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium outline-none"
                      />
                      <span className="text-xs text-stone-400">–</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium outline-none"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* All day switch */}
              <div className="flex items-center justify-between pl-7 pr-2">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400 cursor-pointer">
                  All day
                </label>
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Location */}
              <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <MapPin className="w-4 h-4 shrink-0 text-red-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location or link"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm outline-none placeholder:text-stone-400"
                />
              </div>
            </div>
          )}

          {/* TASK: Due Date & Time Picker */}
          {itemType === 'task' && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
                <Clock className="w-4 h-4 shrink-0 text-emerald-500" />
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium outline-none"
                  />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm font-medium outline-none"
                  />
                </div>
              </div>

              {/* Task completion toggle */}
              <div className="flex items-center gap-3 pl-7">
                <label className="flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => setIsCompleted(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                  />
                  Mark as completed
                </label>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="flex items-start gap-3 text-stone-600 dark:text-stone-400">
            <AlignLeft className="w-4 h-4 shrink-0 mt-2 text-stone-400" />
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description or notes"
              className="flex-1 px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm outline-none placeholder:text-stone-400 resize-none"
            />
          </div>

          {/* Reminders / Notification dropdown */}
          <div className="flex items-center gap-3 text-stone-600 dark:text-stone-400">
            <Bell className="w-4 h-4 shrink-0 text-amber-500" />
            <select
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="flex-1 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm outline-none cursor-pointer"
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Color Palette Selector */}
          <div className="pt-2">
            <label className="text-xs font-medium text-stone-500 mb-2 block">
              Color Label
            </label>
            <div className="flex flex-wrap gap-2">
              {GOOGLE_CALENDAR_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && (
                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl shadow-xs transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
