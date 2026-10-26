export type CalendarItemType = 'event' | 'task';

export interface CalendarEvent {
  id: string;
  type: 'event';
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (24h), e.g. "09:30"
  endDate: string; // YYYY-MM-DD
  endTime?: string; // HH:mm (24h), e.g. "10:30"
  isAllDay: boolean;
  color: string; // Hex color code
  location?: string;
  reminderMinutes?: number; // Minutes before start (e.g. 0, 5, 10, 15, 30, 60, 1440)
  createdAt: number;
  updatedAt: number;
}

export interface CalendarTask {
  id: string;
  type: 'task';
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (24h), e.g. "14:00"
  isCompleted: boolean;
  completedAt?: number;
  color: string;
  reminderMinutes?: number; // Minutes before due time
  createdAt: number;
  updatedAt: number;
}

export type CalendarItem = CalendarEvent | CalendarTask;

export type CalendarViewMode = 'month' | 'week' | 'day' | 'schedule';

export interface CalendarReminderNotice {
  id: string;
  title: string;
  timeStr: string;
  itemType: 'event' | 'task' | 'note';
  color?: string;
  itemId: string;
}

export const GOOGLE_CALENDAR_COLORS = [
  { name: 'Peacock', hex: '#039be5' },
  { name: 'Blueberry', hex: '#3f51b5' },
  { name: 'Basil', hex: '#0b8043' },
  { name: 'Sage', hex: '#33b679' },
  { name: 'Banana', hex: '#f6bf26' },
  { name: 'Tangerine', hex: '#f4511e' },
  { name: 'Flamingo', hex: '#e67c73' },
  { name: 'Tomato', hex: '#d50000' },
  { name: 'Grape', hex: '#8e24aa' },
  { name: 'Lavender', hex: '#7986cb' },
  { name: 'Graphite', hex: '#616161' },
];

export const REMINDER_OPTIONS = [
  { label: 'No reminder', minutes: -1 },
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '10 minutes before', minutes: 10 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 1440 },
];
