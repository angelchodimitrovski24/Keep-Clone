import { CalendarItem, CalendarEvent, CalendarTask } from '@/types/calendar';

/**
 * Formats a Date or date string to iCalendar date-time string: YYYYMMDDTHHmmSS
 */
function formatIcsDateTime(dateStr: string, timeStr?: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  if (!timeStr) {
    return cleanDate; // All-day: YYYYMMDD
  }
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
}

/**
 * Escapes characters for iCalendar text fields
 */
function escapeIcsText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Unescapes characters from iCalendar text fields
 */
function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Generates RFC 5545 compliant iCalendar string from Calendar items (Events & Tasks).
 */
export function generateIcsContent(items: CalendarItem[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Keep Offline//Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Google Keep Calendar',
    'X-WR-TIMEZONE:UTC',
  ];

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const item of items) {
    if (item.type === 'event') {
      const ev = item as CalendarEvent;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${ev.id}`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);

      if (ev.description) {
        lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
      }
      if (ev.location) {
        lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
      }

      if (ev.isAllDay) {
        lines.push(`DTSTART;VALUE=DATE:${ev.startDate.replace(/-/g, '')}`);
        const endD = new Date(ev.endDate || ev.startDate);
        endD.setDate(endD.getDate() + 1); // iCal all-day DTEND is exclusive
        const endY = endD.getFullYear();
        const endM = String(endD.getMonth() + 1).padStart(2, '0');
        const endDay = String(endD.getDate()).padStart(2, '0');
        lines.push(`DTEND;VALUE=DATE:${endY}${endM}${endDay}`);
      } else {
        lines.push(`DTSTART:${formatIcsDateTime(ev.startDate, ev.startTime || '09:00')}`);
        lines.push(`DTEND:${formatIcsDateTime(ev.endDate || ev.startDate, ev.endTime || '10:00')}`);
      }

      if (ev.color) {
        lines.push(`COLOR:${ev.color}`);
      }

      if (ev.reminderMinutes !== undefined && ev.reminderMinutes >= 0) {
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${escapeIcsText(ev.title)}`);
        lines.push(`TRIGGER:-PT${ev.reminderMinutes}M`);
        lines.push('END:VALARM');
      }

      lines.push('END:VEVENT');
    } else {
      const tsk = item as CalendarTask;
      lines.push('BEGIN:VTODO');
      lines.push(`UID:${tsk.id}`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`SUMMARY:${escapeIcsText(tsk.title)}`);

      if (tsk.description) {
        lines.push(`DESCRIPTION:${escapeIcsText(tsk.description)}`);
      }

      if (tsk.dueTime) {
        lines.push(`DUE:${formatIcsDateTime(tsk.dueDate, tsk.dueTime)}`);
      } else {
        lines.push(`DUE;VALUE=DATE:${tsk.dueDate.replace(/-/g, '')}`);
      }

      lines.push(`STATUS:${tsk.isCompleted ? 'COMPLETED' : 'NEEDS-ACTION'}`);
      if (tsk.completedAt) {
        const compStamp = new Date(tsk.completedAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        lines.push(`COMPLETED:${compStamp}`);
      }

      if (tsk.color) {
        lines.push(`COLOR:${tsk.color}`);
      }

      if (tsk.reminderMinutes !== undefined && tsk.reminderMinutes >= 0) {
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push(`DESCRIPTION:${escapeIcsText(tsk.title)}`);
        lines.push(`TRIGGER:-PT${tsk.reminderMinutes}M`);
        lines.push('END:VALARM');
      }

      lines.push('END:VTODO');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Parses iCalendar RFC 5545 string into CalendarEvent and CalendarTask objects.
 */
export function parseIcsContent(icsText: string): CalendarItem[] {
  const items: CalendarItem[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);

  // Unfold folded lines (RFC 5545 lines starting with whitespace)
  const unfolded: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.substring(1);
    } else {
      unfolded.push(line);
    }
  }

  let currentComponent: 'VEVENT' | 'VTODO' | null = null;
  let currentProps: Record<string, string> = {};
  let currentAlarmTrigger: number | undefined = undefined;

  const flushComponent = () => {
    if (!currentComponent) return;
    const now = Date.now();
    const id =
      currentProps['UID'] ||
      `${currentComponent === 'VEVENT' ? 'event' : 'task'}-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const title = unescapeIcsText(currentProps['SUMMARY'] || 'Untitled');
    const description = currentProps['DESCRIPTION'] ? unescapeIcsText(currentProps['DESCRIPTION']) : undefined;
    const color = currentProps['COLOR'] || (currentComponent === 'VEVENT' ? '#039be5' : '#0b8043');

    if (currentComponent === 'VEVENT') {
      const dtStart = currentProps['DTSTART'] || '';
      let isAllDay = false;
      let startDate = new Date().toISOString().slice(0, 10);
      let startTime: string | undefined = undefined;

      if (dtStart.includes('T')) {
        const parts = dtStart.split('T');
        const rawDate = parts[0].replace(/[^0-9]/g, '');
        if (rawDate.length >= 8) {
          startDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        }
        const rawTime = parts[1].replace(/[^0-9]/g, '');
        if (rawTime.length >= 4) {
          startTime = `${rawTime.substring(0, 2)}:${rawTime.substring(2, 4)}`;
        }
      } else {
        isAllDay = true;
        const rawDate = dtStart.replace(/[^0-9]/g, '');
        if (rawDate.length >= 8) {
          startDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        }
      }

      const dtEnd = currentProps['DTEND'] || '';
      let endDate = startDate;
      let endTime: string | undefined = undefined;
      if (dtEnd.includes('T')) {
        const parts = dtEnd.split('T');
        const rawDate = parts[0].replace(/[^0-9]/g, '');
        if (rawDate.length >= 8) {
          endDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        }
        const rawTime = parts[1].replace(/[^0-9]/g, '');
        if (rawTime.length >= 4) {
          endTime = `${rawTime.substring(0, 2)}:${rawTime.substring(2, 4)}`;
        }
      }

      const eventItem: CalendarEvent = {
        id,
        type: 'event',
        title,
        description,
        startDate,
        startTime,
        endDate,
        endTime,
        isAllDay,
        color,
        location: currentProps['LOCATION'] ? unescapeIcsText(currentProps['LOCATION']) : undefined,
        reminderMinutes: currentAlarmTrigger,
        createdAt: now,
        updatedAt: now,
      };
      items.push(eventItem);
    } else if (currentComponent === 'VTODO') {
      const due = currentProps['DUE'] || currentProps['DTSTART'] || '';
      let dueDate = new Date().toISOString().slice(0, 10);
      let dueTime: string | undefined = undefined;

      if (due.includes('T')) {
        const parts = due.split('T');
        const rawDate = parts[0].replace(/[^0-9]/g, '');
        if (rawDate.length >= 8) {
          dueDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        }
        const rawTime = parts[1].replace(/[^0-9]/g, '');
        if (rawTime.length >= 4) {
          dueTime = `${rawTime.substring(0, 2)}:${rawTime.substring(2, 4)}`;
        }
      } else {
        const rawDate = due.replace(/[^0-9]/g, '');
        if (rawDate.length >= 8) {
          dueDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
        }
      }

      const isCompleted = (currentProps['STATUS'] || '').toUpperCase() === 'COMPLETED';

      const taskItem: CalendarTask = {
        id,
        type: 'task',
        title,
        description,
        dueDate,
        dueTime,
        isCompleted,
        color,
        reminderMinutes: currentAlarmTrigger,
        createdAt: now,
        updatedAt: now,
      };
      items.push(taskItem);
    }

    currentComponent = null;
    currentProps = {};
    currentAlarmTrigger = undefined;
  };

  for (const line of unfolded) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      flushComponent();
      currentComponent = 'VEVENT';
    } else if (trimmed === 'BEGIN:VTODO') {
      flushComponent();
      currentComponent = 'VTODO';
    } else if (trimmed === 'END:VEVENT' || trimmed === 'END:VTODO') {
      flushComponent();
    } else if (trimmed.startsWith('TRIGGER:') || trimmed.startsWith('TRIGGER;')) {
      // Parse trigger e.g. -PT15M or -P1D
      const triggerVal = trimmed.split(':').pop() || '';
      const minMatch = triggerVal.match(/(\d+)M/);
      const hourMatch = triggerVal.match(/(\d+)H/);
      const dayMatch = triggerVal.match(/(\d+)D/);
      let mins = 0;
      if (minMatch) mins += parseInt(minMatch[1], 10);
      if (hourMatch) mins += parseInt(hourMatch[1], 10) * 60;
      if (dayMatch) mins += parseInt(dayMatch[1], 10) * 1440;
      currentAlarmTrigger = mins;
    } else if (currentComponent) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const keyPart = trimmed.substring(0, colonIdx);
        const valPart = trimmed.substring(colonIdx + 1);
        const mainKey = keyPart.split(';')[0].toUpperCase();
        currentProps[mainKey] = valPart;
      }
    }
  }

  flushComponent();
  return items;
}

/**
 * Triggers a direct browser download of the Calendar (.ics) file.
 */
export function exportCalendarToIcs(items: CalendarItem[], filename = 'calendar.ics'): void {
  const content = generateIcsContent(items);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
