import { Note, NoteConnectionRole } from '@/types/note';
import { extractNoteLinksFromContent } from './noteLinks';
import { getSavedOllamaConfig, checkOllamaStatus } from './ollamaClient';

export interface ConnectionRoleMeta {
  id: NoteConnectionRole;
  label: string;
  shortLabel: string;
  emoji: string;
  description: string;
  edgeColor: string;
  badgeClass: string;
}

export const CONNECTION_ROLE_META: Record<NoteConnectionRole, ConnectionRoleMeta> = {
  part_of: {
    id: 'part_of',
    label: 'Part of Hub / Child',
    shortLabel: 'Hub / Child',
    emoji: '🏠',
    description: 'Organizes this note under a parent Hub or hierarchy',
    edgeColor: '#f59e0b',
    badgeClass:
      'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  next: {
    id: 'next',
    label: 'Next Step / Sequence',
    shortLabel: 'Next →',
    emoji: '➡️',
    description: 'Links sequential steps, logs, or follow-up notes',
    edgeColor: '#10b981',
    badgeClass:
      'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  },
  source: {
    id: 'source',
    label: 'Source / Reference',
    shortLabel: 'Source',
    emoji: '📌',
    description: 'Attaches tickets, clips, or evidence supporting this note',
    edgeColor: '#3b82f6',
    badgeClass:
      'bg-blue-500/12 text-blue-800 dark:text-blue-300 border-blue-500/30',
  },
  related: {
    id: 'related',
    label: 'Related Idea',
    shortLabel: 'Related',
    emoji: '🔗',
    description: 'Associates related topics across categories',
    edgeColor: '#8b5cf6',
    badgeClass:
      'bg-purple-500/12 text-purple-800 dark:text-purple-300 border-purple-500/30',
  },
};

export const CONNECTION_ROLES_ORDER: NoteConnectionRole[] = [
  'related',
  'part_of',
  'next',
  'source',
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have',
  'will', 'about', 'note', 'notes', 'untitled', 'when', 'where', 'what', 'which',
  'there', 'their', 'they', 'been', 'were', 'then', 'than', 'also', 'some', 'more',
  'only', 'just', 'like', 'very', 'here', 'each', 'make', 'made', 'using', 'used',
]);

export function stripHtmlToPlain(htmlOrMd: string): string {
  if (!htmlOrMd) return '';
  return htmlOrMd
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(note: Note): Set<string> {
  const text = `${note.title || ''} ${stripHtmlToPlain(note.content || '').slice(0, 500)}`.toLowerCase();
  const tokens = text.match(/[\p{L}\p{N}_-]{3,40}/gu) || [];
  const result = new Set<string>();
  for (const tok of tokens) {
    if (!STOPWORDS.has(tok) && !/^\d+$/.test(tok)) {
      result.add(tok);
    }
  }
  return result;
}

function extractTicketKeys(text: string): Set<string> {
  const matches = text.toUpperCase().match(/\b[A-Z]{2,10}-\d{1,6}\b/g) || [];
  return new Set(matches);
}

/**
 * Builds the set of all note IDs that participate in at least one connection
 * (hierarchy parent/child, Hub status, typed connection, linkedNoteIds, or wiki-links).
 */
export function buildConnectedNoteIdsSet(activeNotes: Note[]): Set<string> {
  const connected = new Set<string>();
  const titleToId = new Map<string, string>();

  for (const n of activeNotes) {
    if (n.isTrash) continue;
    const t = (n.title || '').trim().toLowerCase();
    if (t && !titleToId.has(t)) {
      titleToId.set(t, n.id);
    }
  }

  for (const n of activeNotes) {
    if (n.isTrash) continue;

    if (n.isHub) {
      connected.add(n.id);
    }
    if (n.parentNoteId) {
      connected.add(n.id);
      connected.add(n.parentNoteId);
    }
    if (n.childNoteIds && n.childNoteIds.length > 0) {
      connected.add(n.id);
      for (const cid of n.childNoteIds) {
        if (cid) connected.add(cid);
      }
    }
    if (n.linkedNoteIds && n.linkedNoteIds.length > 0) {
      connected.add(n.id);
      for (const lid of n.linkedNoteIds) {
        if (lid) connected.add(lid);
      }
    }
    if (n.connections && n.connections.length > 0) {
      connected.add(n.id);
      for (const conn of n.connections) {
        if (conn.targetId) connected.add(conn.targetId);
      }
    }

    const extracted = extractNoteLinksFromContent(n.content || '');
    if (extracted.length > 0) {
      connected.add(n.id);
      for (const token of extracted) {
        const resolvedId = titleToId.get(token);
        if (resolvedId) {
          connected.add(resolvedId);
        } else {
          // token may already be an id
          const byId = activeNotes.find((cand) => cand.id.toLowerCase() === token);
          if (byId) connected.add(byId.id);
        }
      }
    }
  }

  return connected;
}

export function isNoteUnconnected(note: Note, allActiveNotes: Note[]): boolean {
  if (note.isTrash || note.isArchived || note.isHub) return false;
  const connected = buildConnectedNoteIdsSet(allActiveNotes);
  return !connected.has(note.id);
}

export interface SuggestedConnection {
  note: Note;
  suggestedRole: NoteConnectionRole;
  reason: string;
  score: number;
}

/**
 * Computes deterministic, zero-latency suggested connections for a note
 * based on unlinked mentions, shared labels, ticket keys, keywords, category, and Hub affinity.
 */
export function computeSuggestedConnections(
  currentNote: Note,
  candidates: Note[],
  alreadyConnectedIds: Set<string>,
  limit: number = 5
): SuggestedConnection[] {
  if (!currentNote || !candidates.length) return [];

  const currentPlain = stripHtmlToPlain(currentNote.content || '').toLowerCase();
  const currentTitle = (currentNote.title || '').trim().toLowerCase();
  const currentLabels = new Set((currentNote.labels || []).map((l) => l.toLowerCase()));
  const currentKeywords = extractKeywords(currentNote);
  const currentTickets = extractTicketKeys(`${currentNote.title || ''} ${stripHtmlToPlain(currentNote.content || '')}`);

  const results: SuggestedConnection[] = [];

  for (const cand of candidates) {
    if (!cand || cand.isTrash || cand.id === currentNote.id || alreadyConnectedIds.has(cand.id)) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];
    let suggestedRole: NoteConnectionRole = 'related';

    const candTitle = (cand.title || '').trim().toLowerCase();
    const candPlain = stripHtmlToPlain(cand.content || '').toLowerCase();

    // 1. Unlinked mention in either direction
    if (candTitle.length >= 4 && currentPlain.includes(candTitle)) {
      score += 45;
      reasons.push(`Mentioned in this note`);
    } else if (currentTitle.length >= 4 && candPlain.includes(currentTitle)) {
      score += 40;
      reasons.push(`Mentions "${currentNote.title}"`);
    }

    // 2. Shared Jira / ticket keys
    const candTickets = extractTicketKeys(`${cand.title || ''} ${candPlain}`);
    const sharedTickets = Array.from(currentTickets).filter((t) => candTickets.has(t));
    if (sharedTickets.length > 0) {
      score += 38;
      reasons.push(`Ticket ${sharedTickets[0]}`);
      if ((cand.labels || []).some((l) => ['jira', 'supportbench', 'clipped'].includes(l.toLowerCase()))) {
        suggestedRole = 'source';
      }
    }

    // 3. Shared labels
    const candLabels = (cand.labels || []).map((l) => l.toLowerCase());
    const sharedLabels = candLabels.filter((l) => currentLabels.has(l));
    if (sharedLabels.length > 0) {
      score += sharedLabels.length * 22;
      reasons.push(`Shares #${sharedLabels[0]}${sharedLabels.length > 1 ? ` +${sharedLabels.length - 1}` : ''}`);
    }

    // 4. Hub candidate in same category
    if (cand.isHub && !currentNote.parentNoteId) {
      if (cand.category && currentNote.category && cand.category.toLowerCase() === currentNote.category.toLowerCase()) {
        score += 24;
        reasons.push(`Hub in ${cand.category}`);
        suggestedRole = 'part_of';
      } else {
        score += 8;
      }
    }

    // 5. Keyword overlap
    const candKeywords = extractKeywords(cand);
    const sharedKeywords: string[] = [];
    for (const kw of currentKeywords) {
      if (candKeywords.has(kw)) sharedKeywords.push(kw);
    }
    if (sharedKeywords.length >= 2) {
      score += Math.min(32, sharedKeywords.length * 8);
      reasons.push(`Shared topic: ${sharedKeywords.slice(0, 2).join(', ')}`);
    }

    // 6. Same category bonus
    if (
      currentNote.category &&
      cand.category &&
      currentNote.category.toLowerCase() === cand.category.toLowerCase()
    ) {
      score += 10;
      if (reasons.length === 0) reasons.push(`Same category (${cand.category})`);
    }

    // 7. Temporal proximity (edited within 12h of each other)
    const timeDiff = Math.abs((currentNote.updatedAt || 0) - (cand.updatedAt || 0));
    if (score > 0 && timeDiff < 12 * 60 * 60 * 1000) {
      score += 6;
    }

    // Role refinement for clipped / ticket sources
    if (
      suggestedRole === 'related' &&
      (cand.labels || []).some((l) => ['jira', 'supportbench', 'clipped'].includes(l.toLowerCase()))
    ) {
      suggestedRole = 'source';
    }

    if (score >= 18 && reasons.length > 0) {
      results.push({
        note: cand,
        suggestedRole,
        reason: reasons[0],
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
  return results.slice(0, limit);
}

/**
 * Optional local AI connection suggester backed by the existing /api/ollama route.
 */
export async function suggestConnectionsWithOllama(
  currentNote: Note,
  candidates: Note[],
  alreadyConnectedIds: Set<string>
): Promise<{ suggestions: SuggestedConnection[]; error?: string }> {
  const cfg = getSavedOllamaConfig();
  const status = await checkOllamaStatus(cfg.baseUrl);
  if (!status.isRunning) {
    return {
      suggestions: [],
      error: status.error || 'Ollama is not running locally.',
    };
  }

  const model = cfg.selectedModel || status.models?.[0]?.name;
  if (!model) {
    return {
      suggestions: [],
      error: 'No Ollama model installed. Open Settings → Ollama AI to select or pull a model.',
    };
  }

  const eligible = candidates
    .filter((n) => !n.isTrash && n.id !== currentNote.id && !alreadyConnectedIds.has(n.id))
    .slice(0, 40);

  if (eligible.length === 0) {
    return { suggestions: [] };
  }

  const candidateIndex = new Map(eligible.map((n) => [n.id, n]));
  const catalogLines = eligible.map((n) => {
    const snippet = stripHtmlToPlain(n.content || '').slice(0, 90);
    return `- id="${n.id}" | title="${(n.title || 'Untitled').slice(0, 60)}" | cat="${n.category || 'None'}" | hub=${Boolean(n.isHub)} | tags=[${(n.labels || []).join(',')}] | text="${snippet}"`;
  });

  const prompt = `You are organizing a personal knowledge base.
Target note:
Title: "${currentNote.title || 'Untitled'}"
Category: "${currentNote.category || 'None'}"
Tags: [${(currentNote.labels || []).join(', ')}]
Body: "${stripHtmlToPlain(currentNote.content || '').slice(0, 600)}"

Candidate notes:
${catalogLines.join('\n')}

Return ONLY valid JSON (no markdown fences) as an array of up to 4 most meaningful connections:
[{"id":"<candidate id>","role":"part_of|next|source|related","reason":"<short 4-8 word explanation>"}]
Use "part_of" if the candidate is a good parent Hub for this note, "next" if sequential, "source" if reference/ticket, "related" otherwise.`;

  try {
    const res = await fetch('/api/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        baseUrl: cfg.baseUrl,
        model,
        stream: false,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      return { suggestions: [], error: `Ollama returned HTTP ${res.status}` };
    }

    const data = await res.json();
    const raw = (data?.message?.content || data?.response || '').trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { suggestions: [], error: 'Could not parse AI suggestions.' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id?: string;
      role?: string;
      reason?: string;
    }>;

    const suggestions: SuggestedConnection[] = [];
    for (const item of parsed) {
      if (!item?.id) continue;
      const cand = candidateIndex.get(item.id);
      if (!cand) continue;
      const role: NoteConnectionRole =
        item.role === 'part_of' || item.role === 'next' || item.role === 'source'
          ? item.role
          : 'related';
      suggestions.push({
        note: cand,
        suggestedRole: role,
        reason: (item.reason || 'AI suggested connection').slice(0, 80),
        score: 90,
      });
    }

    return { suggestions };
  } catch (err) {
    return {
      suggestions: [],
      error: err instanceof Error ? err.message : 'Failed generating AI suggestions',
    };
  }
}

export interface KnowledgeGraphNode {
  id: string;
  note: Note;
  degree: number;
  x: number;
  y: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  role: NoteConnectionRole;
  label?: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

/**
 * Builds nodes and directed typed edges for KnowledgeMapView,
 * supporting either the full active structure or a 1-hop/2-hop ego focus around a note.
 */
export function buildKnowledgeGraph(
  notes: Note[],
  options: {
    focusNoteId?: string | null;
    depth?: 1 | 2;
    hubsOnly?: boolean;
    categoryFilter?: string | null;
    includeUnconnected?: boolean;
  } = {}
): KnowledgeGraphData {
  const active = notes.filter((n) => !n.isTrash && !n.isArchived);
  const noteMap = new Map(active.map((n) => [n.id, n]));
  const titleMap = new Map<string, Note>();
  for (const n of active) {
    const t = (n.title || '').trim().toLowerCase();
    if (t && !titleMap.has(t)) titleMap.set(t, n);
  }

  const edgeMap = new Map<string, KnowledgeGraphEdge>();
  const addEdge = (sourceId: string, targetId: string, role: NoteConnectionRole, label?: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    if (!noteMap.has(sourceId) || !noteMap.has(targetId)) return;
    const key = `${sourceId}__${targetId}__${role}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { id: key, sourceId, targetId, role, label });
    }
  };

  for (const n of active) {
    if (n.parentNoteId && noteMap.has(n.parentNoteId)) {
      addEdge(n.parentNoteId, n.id, 'part_of');
    }
    for (const cid of n.childNoteIds || []) {
      addEdge(n.id, cid, 'part_of');
    }
    const explicitTargetRoles = new Map<string, NoteConnectionRole>();
    for (const conn of n.connections || []) {
      addEdge(n.id, conn.targetId, conn.role, conn.label);
      explicitTargetRoles.set(conn.targetId, conn.role);
    }
    for (const lid of n.linkedNoteIds || []) {
      if (!explicitTargetRoles.has(lid)) {
        addEdge(n.id, lid, 'related');
      }
    }
    for (const tok of extractNoteLinksFromContent(n.content || '')) {
      const byId = noteMap.get(tok);
      const target = byId || titleMap.get(tok);
      if (target && !explicitTargetRoles.has(target.id)) {
        addEdge(n.id, target.id, 'related');
      }
    }
  }

  const allEdges = Array.from(edgeMap.values());

  // Determine included node IDs based on filters
  let includedIds: Set<string>;
  if (options.focusNoteId && noteMap.has(options.focusNoteId)) {
    includedIds = new Set([options.focusNoteId]);
    const hops = options.depth || 1;
    for (let step = 0; step < hops; step++) {
      const frontier = new Set(includedIds);
      for (const e of allEdges) {
        if (frontier.has(e.sourceId)) includedIds.add(e.targetId);
        if (frontier.has(e.targetId)) includedIds.add(e.sourceId);
      }
    }
  } else {
    includedIds = new Set<string>();
    const connectedIds = new Set<string>();
    for (const e of allEdges) {
      connectedIds.add(e.sourceId);
      connectedIds.add(e.targetId);
    }

    for (const n of active) {
      if (options.categoryFilter && (n.category || '') !== options.categoryFilter) {
        continue;
      }
      if (options.hubsOnly) {
        if (n.isHub || (n.childNoteIds && n.childNoteIds.length > 0)) {
          includedIds.add(n.id);
        }
        continue;
      }
      if (options.includeUnconnected || n.isHub || connectedIds.has(n.id)) {
        includedIds.add(n.id);
      }
    }

    // If category filter selected, also include immediate cross-category neighbors
    if (options.categoryFilter) {
      const base = new Set(includedIds);
      for (const e of allEdges) {
        if (base.has(e.sourceId)) includedIds.add(e.targetId);
        if (base.has(e.targetId)) includedIds.add(e.sourceId);
      }
    }
  }

  const edges = allEdges.filter(
    (e) => includedIds.has(e.sourceId) && includedIds.has(e.targetId)
  );

  const degreeMap = new Map<string, number>();
  for (const id of includedIds) degreeMap.set(id, 0);
  for (const e of edges) {
    degreeMap.set(e.sourceId, (degreeMap.get(e.sourceId) || 0) + 1);
    degreeMap.set(e.targetId, (degreeMap.get(e.targetId) || 0) + 1);
  }

  // Deterministic, readable initial layout:
  // If focused on a note, arrange in radial rings around center; otherwise cluster around Hubs.
  const nodeList = Array.from(includedIds)
    .map((id) => noteMap.get(id)!)
    .filter(Boolean);

  const positioned: KnowledgeGraphNode[] = [];
  const width = 960;
  const height = 620;
  const cx = width / 2;
  const cy = height / 2;

  if (options.focusNoteId && includedIds.has(options.focusNoteId)) {
    const centerId = options.focusNoteId;
    const ring1Ids = new Set<string>();
    for (const e of edges) {
      if (e.sourceId === centerId) ring1Ids.add(e.targetId);
      if (e.targetId === centerId) ring1Ids.add(e.sourceId);
    }
    const ring1 = nodeList.filter((n) => n.id !== centerId && ring1Ids.has(n.id));
    const ring2 = nodeList.filter((n) => n.id !== centerId && !ring1Ids.has(n.id));

    const centerNote = noteMap.get(centerId);
    if (centerNote) {
      positioned.push({
        id: centerId,
        note: centerNote,
        degree: degreeMap.get(centerId) || 0,
        x: cx,
        y: cy,
      });
    }

    ring1.forEach((n, idx) => {
      const angle = (idx / Math.max(1, ring1.length)) * Math.PI * 2 - Math.PI / 2;
      positioned.push({
        id: n.id,
        note: n,
        degree: degreeMap.get(n.id) || 0,
        x: cx + Math.cos(angle) * 210,
        y: cy + Math.sin(angle) * 175,
      });
    });

    ring2.forEach((n, idx) => {
      const angle = (idx / Math.max(1, ring2.length)) * Math.PI * 2 - Math.PI / 4;
      positioned.push({
        id: n.id,
        note: n,
        degree: degreeMap.get(n.id) || 0,
        x: cx + Math.cos(angle) * 355,
        y: cy + Math.sin(angle) * 265,
      });
    });
  } else {
    // Cluster hubs along an inner/upper arc and surround with their connected notes
    const hubs = nodeList.filter((n) => n.isHub || (n.childNoteIds && n.childNoteIds.length > 0));
    const nonHubs = nodeList.filter((n) => !hubs.includes(n));
    const placed = new Map<string, { x: number; y: number }>();

    const hubRadiusX = hubs.length <= 1 ? 0 : Math.min(280, 140 + hubs.length * 25);
    const hubRadiusY = hubs.length <= 1 ? 0 : Math.min(180, 95 + hubs.length * 16);

    hubs.forEach((hub, idx) => {
      const angle = (idx / Math.max(1, hubs.length)) * Math.PI * 2 - Math.PI / 2;
      const hx = hubs.length === 1 ? cx : cx + Math.cos(angle) * hubRadiusX;
      const hy = hubs.length === 1 ? cy - 40 : cy + Math.sin(angle) * hubRadiusY;
      placed.set(hub.id, { x: hx, y: hy });
    });

    // Place non-hubs near their parent/first connected hub, or outer spiral
    const siblingCounts = new Map<string, number>();
    let orphanIdx = 0;

    for (const n of nonHubs) {
      let anchorId = n.parentNoteId && placed.has(n.parentNoteId) ? n.parentNoteId : null;
      if (!anchorId) {
        const linkedHubEdge = edges.find(
          (e) =>
            (e.sourceId === n.id && placed.has(e.targetId)) ||
            (e.targetId === n.id && placed.has(e.sourceId))
        );
        if (linkedHubEdge) {
          anchorId = placed.has(linkedHubEdge.sourceId)
            ? linkedHubEdge.sourceId
            : linkedHubEdge.targetId;
        }
      }

      if (anchorId && placed.has(anchorId)) {
        const anchor = placed.get(anchorId)!;
        const count = siblingCounts.get(anchorId) || 0;
        siblingCounts.set(anchorId, count + 1);
        const angle = (count * 0.95) - Math.PI / 3;
        const dist = 125 + Math.floor(count / 6) * 55;
        placed.set(n.id, {
          x: anchor.x + Math.cos(angle) * dist,
          y: anchor.y + Math.sin(angle) * dist,
        });
      } else {
        const angle = orphanIdx * 0.72;
        const dist = 240 + (orphanIdx % 4) * 50;
        orphanIdx++;
        placed.set(n.id, {
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
        });
      }
    }

    for (const n of nodeList) {
      const pos = placed.get(n.id) || { x: cx, y: cy };
      positioned.push({
        id: n.id,
        note: n,
        degree: degreeMap.get(n.id) || 0,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
      });
    }
  }

  return { nodes: positioned, edges };
}
