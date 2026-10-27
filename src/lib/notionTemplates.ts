import { Note, NoteColor } from '@/types/note';

export interface GeneratedSubpageDef {
  title: string;
  content: string;
  isExisting?: boolean;
  existingNoteId?: string;
}

export interface DayOption {
  date: Date;
  isoDate: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Tuesday, Oct 27"
  shortLabel: string; // e.g. "Tue 10/27"
  isToday: boolean;
}

/**
 * Returns a list of past N days starting with Today.
 */
export function getDaysRange(count: number): DayOption[] {
  const result: DayOption[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const isToday = i === 0;

    const dayName = d.toLocaleDateString(undefined, { weekday: 'long' });
    const monthName = d.toLocaleDateString(undefined, { month: 'short' });
    const dayNum = d.getDate();
    const shortDayName = d.toLocaleDateString(undefined, { weekday: 'short' });

    result.push({
      date: d,
      isoDate: d.toISOString().slice(0, 10),
      dayLabel: `${dayName}, ${monthName} ${dayNum}`,
      shortLabel: `${shortDayName} ${d.getMonth() + 1}/${dayNum}`,
      isToday,
    });
  }

  return result;
}

/**
 * Starter content template for a daily subpage.
 */
export function generateDailyStarterContent(dayLabel: string): string {
  return `### 🎯 Priorities & Focus\n- [ ] Top priority for the day\n- [ ] Important task or deliverable\n\n### 📝 Notes & Log\n*Write meeting notes, daily updates, or thoughts here...*\n\n### 📌 Wrap-up & Reflections\n- What went well?\n- Action items for tomorrow:`;
}

/**
 * Starter content template for project / keyword hub.
 */
export function generateKeywordHubContent(keyword: string, linkedCount: number): string {
  return `## 📌 ${keyword} Hub\n\nCentral workspace for **${keyword}**. Access all related sub-pages and linked notes below.\n\n- **Topic / Keyword**: \`${keyword}\`\n- **Linked Notes & Pages**: ${linkedCount}\n- **Created**: ${new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}\n\n---\n*Add sub-pages or link notes above to keep everything organized in one place.*`;
}

/**
 * Starter content for topic sub-pages.
 */
export function generateTopicSubpageContent(topicName: string): string {
  switch (topicName.toLowerCase()) {
    case 'overview & roadmap':
    case 'overview':
      return `### 🗺️ Overview & Goals\n- **Objective**: Define main goal here\n- **Timeline & Milestones**:\n  - [ ] Milestone 1\n  - [ ] Milestone 2\n\n### 🔗 Key Links & Resources\n- Documentation / References`;
    case 'meeting notes & decisions':
    case 'meetings':
      return `### 📅 Meeting Log\n\n#### Meeting Date: ${new Date().toLocaleDateString()}\n**Attendees**: \n**Key Takeaways**:\n- Decision 1\n- Decision 2\n\n**Action Items**:\n- [ ] Assigned task`;
    case 'tasks & action items':
    case 'tasks':
      return `### 📋 Action Items\n- [ ] Urgent task\n- [ ] In-progress item\n- [ ] Upcoming backlog item\n\n### 💡 Ideas & Backlog\n- Future improvement idea`;
    default:
      return `### 📝 ${topicName}\n*Start drafting content for this section...*`;
  }
}

/**
 * Filters notes matching a given keyword across title, content, labels, or category.
 */
export function filterNotesByKeyword(notes: Note[], keyword: string): Note[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];

  return notes.filter((n) => {
    if (n.isTrash) return false;
    const titleMatch = Boolean(n.title && n.title.toLowerCase().includes(q));
    const contentMatch = Boolean(n.content && n.content.toLowerCase().includes(q));
    const labelMatch = Boolean(n.labels && n.labels.some((l) => l.toLowerCase().includes(q)));
    const categoryMatch = Boolean(n.category && n.category.toLowerCase().includes(q));

    return titleMatch || contentMatch || labelMatch || categoryMatch;
  });
}

/**
 * Filters notes that were created or updated within the specified days.
 */
export function filterNotesByDays(
  notes: Note[],
  daysCount: number,
  field: 'created' | 'updated' = 'created'
): Note[] {
  const cutoff = Date.now() - daysCount * 24 * 60 * 60 * 1000;
  return notes.filter((n) => {
    if (n.isTrash) return false;
    const ts = field === 'created' ? n.createdAt : n.updatedAt;
    return ts >= cutoff;
  });
}
