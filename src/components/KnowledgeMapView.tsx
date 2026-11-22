'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Home,
  LayoutGrid,
  Link2,
  Maximize2,
  Plus,
  RefreshCw,
  Rows,
  Search,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
  ArrowUpRight,
  Compass,
} from 'lucide-react';
import { Note, NoteConnectionRole } from '@/types/note';
import { useKeep } from '@/context/KeepContext';
import { getAllActiveNotesForStructureFromDB } from '@/lib/db';
import {
  CONNECTION_ROLE_META,
  CONNECTION_ROLES_ORDER,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  buildKnowledgeGraph,
  computeSuggestedConnections,
  stripHtmlToPlain,
} from '@/lib/noteGraph';

interface KnowledgeMapViewProps {
  onSelectNote: (note: Note) => void;
}

export const KnowledgeMapView: React.FC<KnowledgeMapViewProps> = ({ onSelectNote }) => {
  const {
    notes,
    categories,
    selectedCategory,
    currentFilter,
    setLayoutMode,
    mapFocusNoteId,
    setMapFocusNoteId,
    toggleHubNote,
    connectNotes,
    disconnectNotes,
    addNote,
  } = useKeep();

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState(true);

  // Filters & controls
  const [hubsOnly, setHubsOnly] = useState(false);
  const [includeUnconnected, setIncludeUnconnected] = useState(true);
  const [depth, setDepth] = useState<1 | 2>(1);
  const baseCategory = currentFilter === 'category' && selectedCategory ? selectedCategory : '';
  const [categoryOverride, setCategoryOverride] = useState<{ forBase: string; value: string } | null>(null);
  const localCategory =
    categoryOverride && categoryOverride.forBase === baseCategory ? categoryOverride.value : baseCategory;
  const setLocalCategory = useCallback(
    (value: string) => setCategoryOverride({ forBase: baseCategory, value }),
    [baseCategory]
  );
  const [mapQuery, setMapQuery] = useState('');

  // Selection & Connect mode
  const [selectedNodeState, setSelectedNodeState] = useState<{ forFocus: string | null; id: string | null }>({
    forFocus: mapFocusNoteId,
    id: mapFocusNoteId,
  });
  const selectedNodeId =
    selectedNodeState.forFocus === mapFocusNoteId ? selectedNodeState.id : mapFocusNoteId;
  const setSelectedNodeId = useCallback(
    (id: string | null) => setSelectedNodeState({ forFocus: mapFocusNoteId, id }),
    [mapFocusNoteId]
  );
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [connectRole, setConnectRole] = useState<NoteConnectionRole>('related');
  const [isCreatingHub, setIsCreatingHub] = useState(false);
  const [newHubTitle, setNewHubTitle] = useState('');

  // Viewport Pan / Zoom & Custom node positions
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{
    type: 'pan' | 'node';
    nodeId?: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const lastDragMovedRef = useRef(false);

  const loadGraphNotes = async () => {
    setIsLoadingMap(true);
    try {
      const items = await getAllActiveNotesForStructureFromDB(800);
      setAllNotes(items);
    } finally {
      setIsLoadingMap(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getAllActiveNotesForStructureFromDB(800)
      .then((items) => {
        if (!cancelled) {
          setAllNotes(items);
          setIsLoadingMap(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoadingMap(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [notes]);

  const graph = useMemo(() => {
    return buildKnowledgeGraph(allNotes, {
      focusNoteId: mapFocusNoteId,
      depth,
      hubsOnly,
      categoryFilter: localCategory || null,
      includeUnconnected,
    });
  }, [allNotes, mapFocusNoteId, depth, hubsOnly, localCategory, includeUnconnected]);

  // Resolve final coordinates (allowing user drag overrides)
  const resolvedNodes: KnowledgeGraphNode[] = useMemo(() => {
    return graph.nodes.map((node) => {
      const override = nodePositions[node.id];
      return override ? { ...node, x: override.x, y: override.y } : node;
    });
  }, [graph.nodes, nodePositions]);

  const nodeById = useMemo(
    () => new Map(resolvedNodes.map((n) => [n.id, n])),
    [resolvedNodes]
  );

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodeById.get(selectedNodeId) || null : null),
    [selectedNodeId, nodeById]
  );

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return { incoming: [] as KnowledgeGraphEdge[], outgoing: [] as KnowledgeGraphEdge[] };
    return {
      incoming: graph.edges.filter((e) => e.targetId === selectedNodeId),
      outgoing: graph.edges.filter((e) => e.sourceId === selectedNodeId),
    };
  }, [selectedNodeId, graph.edges]);

  const selectedSuggestions = useMemo(() => {
    if (!selectedNode) return [];
    const connected = new Set<string>([selectedNode.id]);
    for (const e of graph.edges) {
      if (e.sourceId === selectedNode.id) connected.add(e.targetId);
      if (e.targetId === selectedNode.id) connected.add(e.sourceId);
    }
    return computeSuggestedConnections(selectedNode.note, allNotes, connected, 4);
  }, [selectedNode, graph.edges, allNotes]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
      lastDragMovedRef.current = true;
    }
    if (drag.type === 'pan') {
      setPan({ x: drag.origX + dx, y: drag.origY + dy });
    } else if (drag.type === 'node' && drag.nodeId) {
      setNodePositions((prev) => ({
        ...prev,
        [drag.nodeId!]: {
          x: drag.origX + dx / zoom,
          y: drag.origY + dy / zoom,
        },
      }));
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const handleNodeClick = async (node: KnowledgeGraphNode) => {
    if (connectFromId) {
      if (connectFromId !== node.id) {
        await connectNotes(connectFromId, node.id, connectRole);
        await loadGraphNotes();
      }
      setConnectFromId(null);
      setSelectedNodeId(node.id);
      return;
    }
    setSelectedNodeId(node.id);
  };

  const handleCreateHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHubTitle.trim();
    if (!trimmed) return;
    const created = await addNote({
      title: trimmed,
      content: `## 🏠 ${trimmed} Hub\n\nCentral index note for ${trimmed}. Add sub-pages or type \`[[\` to link related notes.`,
      isHub: true,
      noteType: 'notion',
      category: localCategory || null,
    });
    setNewHubTitle('');
    setIsCreatingHub(false);
    await loadGraphNotes();
    if (created) setSelectedNodeId(created.id);
  };

  const qLower = mapQuery.trim().toLowerCase();

  return (
    <div className="w-full space-y-3 animate-in fade-in duration-150">
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-[#202124] border border-stone-200 dark:border-stone-800 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick View Mode Switcher */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className="px-2 py-1 rounded-md text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 inline-flex items-center gap-1 cursor-pointer"
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className="px-2 py-1 rounded-md text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 inline-flex items-center gap-1 cursor-pointer"
              title="List View"
            >
              <Rows className="w-3.5 h-3.5" />
              <span className="hidden md:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('notion')}
              className="px-2 py-1 rounded-md text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 inline-flex items-center gap-1 cursor-pointer"
              title="Notion List"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Notion</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('map')}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-[#2c2d30] text-amber-600 dark:text-amber-400 font-semibold shadow-2xs inline-flex items-center gap-1 cursor-pointer"
              title="Knowledge Map"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>

          {/* Search highlight */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
            <input
              type="text"
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              placeholder="Highlight node..."
              className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 border border-transparent focus:border-amber-500/50 outline-none w-36 sm:w-44"
            />
          </div>

          {/* Category filter */}
          <select
            value={localCategory}
            onChange={(e) => setLocalCategory(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs font-medium text-stone-700 dark:text-stone-200 outline-none cursor-pointer"
            aria-label="Filter map by category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setHubsOnly(!hubsOnly)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              hubsOnly
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold'
                : 'bg-stone-100 dark:bg-stone-800 border-transparent text-stone-600 dark:text-stone-300'
            }`}
          >
            🏠 Hubs Only
          </button>

          {!mapFocusNoteId && !hubsOnly && (
            <button
              type="button"
              onClick={() => setIncludeUnconnected(!includeUnconnected)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                includeUnconnected
                  ? 'bg-stone-200/80 dark:bg-stone-700 border-stone-300 dark:border-stone-600 text-stone-800 dark:text-stone-100'
                  : 'bg-stone-100 dark:bg-stone-800 border-transparent text-stone-500'
              }`}
            >
              {includeUnconnected ? 'Showing All' : 'Connected Only'}
            </button>
          )}

          {mapFocusNoteId && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200">
              <span>Focus ({depth}-hop)</span>
              <button
                type="button"
                onClick={() => setDepth(depth === 1 ? 2 : 1)}
                className="px-1.5 py-0.2 rounded bg-amber-500/20 font-semibold cursor-pointer"
              >
                {depth === 1 ? 'Expand 2-hop' : '1-hop'}
              </button>
              <button
                type="button"
                onClick={() => setMapFocusNoteId(null)}
                className="p-0.5 hover:text-red-500 cursor-pointer"
                title="Exit focus mode"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* New Hub quick creator */}
          {isCreatingHub ? (
            <form onSubmit={handleCreateHubSubmit} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={newHubTitle}
                onChange={(e) => setNewHubTitle(e.target.value)}
                placeholder="Hub title..."
                className="px-2.5 py-1 text-xs rounded-lg bg-stone-100 dark:bg-stone-800 border border-amber-500/50 outline-none w-36"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 text-xs font-semibold cursor-pointer"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingHub(false)}
                className="p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingHub(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Hub</span>
            </button>
          )}

          {/* Zoom & Reset */}
          <div className="inline-flex items-center gap-0.5 bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.45, Number((z - 0.15).toFixed(2))))}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-stone-500">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setNodePositions({});
              }}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              title="Reset layout & viewport"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Connect Mode Banner */}
      {connectFromId && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-100">
          <div className="flex items-center gap-2 flex-wrap">
            <Link2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Connecting from{' '}
              <strong>{nodeById.get(connectFromId)?.note.title || 'Selected note'}</strong> —
              choose role &amp; click any target note:
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {CONNECTION_ROLES_ORDER.map((r) => {
                const meta = CONNECTION_ROLE_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setConnectRole(r)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer ${
                      connectRole === r
                        ? `${meta.badgeClass} font-semibold`
                        : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {meta.emoji} {meta.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConnectFromId(null)}
            className="px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10 font-medium cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Canvas + Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Interactive Canvas */}
        <div
          className={`${
            selectedNode ? 'lg:col-span-8' : 'lg:col-span-12'
          } relative h-[620px] rounded-2xl border border-stone-200 dark:border-stone-800 bg-[radial-gradient(#d6d3d1_1px,transparent_1px)] dark:bg-[radial-gradient(#2c2d30_1px,transparent_1px)] [background-size:20px_20px] bg-stone-50/80 dark:bg-[#161718] overflow-hidden select-none cursor-grab active:cursor-grabbing`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg === 'true') {
              dragRef.current = {
                type: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                origX: pan.x,
                origY: pan.y,
                moved: false,
              };
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Legend */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-[#202124]/90 backdrop-blur-xs border border-stone-200 dark:border-stone-700/80 text-[10px] font-medium shadow-xs pointer-events-none">
            {CONNECTION_ROLES_ORDER.map((r) => {
              const meta = CONNECTION_ROLE_META[r];
              return (
                <span key={r} className="inline-flex items-center gap-1 text-stone-600 dark:text-stone-300">
                  <span
                    className="w-2.5 h-0.5 rounded-full inline-block"
                    style={{ backgroundColor: meta.edgeColor }}
                  />
                  <span>{meta.emoji} {meta.shortLabel}</span>
                </span>
              );
            })}
            <span className="text-stone-400 ml-1">
              • {resolvedNodes.length} notes, {graph.edges.length} links
            </span>
          </div>

          {isLoadingMap ? (
            <div className="w-full h-full flex items-center justify-center text-sm text-stone-400">
              Building knowledge map…
            </div>
          ) : resolvedNodes.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
              <Compass className="w-10 h-10 text-amber-500/70 mb-2" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                No notes match the current map filter
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm">
                Create a Hub above or turn on &ldquo;Showing All&rdquo; to visualize and connect your notes.
              </p>
            </div>
          ) : (
            <div
              data-canvas-bg="true"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
              className="absolute inset-0 w-[1800px] h-[1200px]"
            >
              {/* SVG Edges Layer */}
              <svg
                data-canvas-bg="true"
                width="1800"
                height="1200"
                className="absolute inset-0 pointer-events-none"
              >
                <defs>
                  {CONNECTION_ROLES_ORDER.map((r) => (
                    <marker
                      key={`arrow-${r}`}
                      id={`arrow-${r}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={CONNECTION_ROLE_META[r].edgeColor} />
                    </marker>
                  ))}
                </defs>

                {graph.edges.map((edge) => {
                  const s = nodeById.get(edge.sourceId);
                  const t = nodeById.get(edge.targetId);
                  if (!s || !t) return null;
                  const meta = CONNECTION_ROLE_META[edge.role];
                  const isHighlighted =
                    selectedNodeId === edge.sourceId || selectedNodeId === edge.targetId;

                  const sx = s.x + 85;
                  const sy = s.y + 28;
                  const tx = t.x + 85;
                  const ty = t.y + 28;
                  const mx = (sx + tx) / 2;
                  const my = (sy + ty) / 2 - 22;

                  return (
                    <path
                      key={edge.id}
                      d={`M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`}
                      fill="none"
                      stroke={meta.edgeColor}
                      strokeWidth={isHighlighted ? 2.6 : 1.5}
                      strokeDasharray={edge.role === 'source' ? '5 4' : undefined}
                      strokeOpacity={selectedNodeId && !isHighlighted ? 0.25 : 0.78}
                      markerEnd={`url(#arrow-${edge.role})`}
                    />
                  );
                })}
              </svg>

              {/* Nodes Layer */}
              {resolvedNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isConnectOrigin = connectFromId === node.id;
                const isHub = Boolean(node.note.isHub);
                const matchesSearch =
                  qLower.length > 0 &&
                  (node.note.title.toLowerCase().includes(qLower) ||
                    (node.note.category || '').toLowerCase().includes(qLower) ||
                    (node.note.labels || []).some((l) => l.toLowerCase().includes(qLower)));

                return (
                  <div
                    key={node.id}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      lastDragMovedRef.current = false;
                      dragRef.current = {
                        type: 'node',
                        nodeId: node.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: node.x,
                        origY: node.y,
                        moved: false,
                      };
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (lastDragMovedRef.current) {
                        lastDragMovedRef.current = false;
                        return;
                      }
                      handleNodeClick(node);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSelectNote(node.note);
                    }}
                    className={`group absolute w-[170px] p-2.5 rounded-xl border transition-shadow cursor-pointer ${
                      isConnectOrigin
                        ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-950/60 shadow-lg z-20'
                        : isSelected
                        ? 'ring-2 ring-amber-500 border-amber-500 bg-white dark:bg-[#25262a] shadow-xl z-20'
                        : matchesSearch
                        ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/90 dark:bg-blue-950/50 shadow-md z-10'
                        : isHub
                        ? 'border-amber-400/70 dark:border-amber-500/50 bg-amber-50/90 dark:bg-[#26231c] shadow-sm hover:shadow-md z-10'
                        : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#202124] shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs shrink-0">
                          {isHub ? '🏠' : '📄'}
                        </span>
                        <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {node.note.title || 'Untitled Note'}
                        </span>
                      </div>

                      {/* Quick Connect Handle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnectFromId(node.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-stone-950 transition-all shrink-0 cursor-pointer"
                        title="Connect from this note"
                      >
                        <Link2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-stone-400">
                      <span className="truncate">
                        {node.note.category || (isHub ? 'Hub' : 'Note')}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-stone-500 dark:text-stone-300 font-mono shrink-0">
                        {node.degree}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Node Inspector Drawer */}
        {selectedNode && (
          <div className="lg:col-span-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#202124] p-4 flex flex-col gap-3 max-h-[620px] overflow-y-auto shadow-sm animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span>{selectedNode.note.isHub ? '🏠' : '📄'}</span>
                  <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100 truncate">
                    {selectedNode.note.title || 'Untitled Note'}
                  </h3>
                </div>
                {selectedNode.note.category && (
                  <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    {selectedNode.note.category}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-stone-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectNote(selectedNode.note)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Open Note</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await toggleHubNote(selectedNode.id);
                  await loadGraphNotes();
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  selectedNode.note.isHub
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                    : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>{selectedNode.note.isHub ? 'Pinned Hub' : 'Make Hub'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMapFocusNoteId(selectedNode.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Focus</span>
              </button>

              <button
                type="button"
                onClick={() => setConnectFromId(selectedNode.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Connect…</span>
              </button>
            </div>

            {/* Content preview */}
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-4 bg-stone-50 dark:bg-stone-900/50 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.05]">
              {selectedNode.note.isEncrypted
                ? '🔒 Encrypted note'
                : selectedNode.note.isList
                ? `${selectedNode.note.todos.length} checklist items`
                : stripHtmlToPlain(selectedNode.note.content || '') || 'No preview content'}
            </p>

            {/* Connections list */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Connections ({selectedNodeEdges.outgoing.length + selectedNodeEdges.incoming.length})
              </div>
              <div className="space-y-1">
                {selectedNodeEdges.outgoing.map((e) => {
                  const target = nodeById.get(e.targetId);
                  const meta = CONNECTION_ROLE_META[e.role];
                  if (!target) return null;
                  return (
                    <div
                      key={`out-${e.id}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/70 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(target.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer hover:underline"
                      >
                        <span>{meta.emoji}</span>
                        <span className="text-[10px] text-stone-400 shrink-0">{meta.shortLabel}:</span>
                        <span className="truncate font-medium">{target.note.title || 'Untitled'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await disconnectNotes(selectedNode.id, target.id, e.role);
                          await loadGraphNotes();
                        }}
                        className="p-0.5 text-stone-400 hover:text-red-500 cursor-pointer"
                        title="Remove connection"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                {selectedNodeEdges.incoming.map((e) => {
                  const source = nodeById.get(e.sourceId);
                  const meta = CONNECTION_ROLE_META[e.role];
                  if (!source) return null;
                  return (
                    <div
                      key={`in-${e.id}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(source.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer hover:underline"
                      >
                        <span>↩</span>
                        <span className="text-[10px] text-purple-500 shrink-0">{meta.shortLabel}:</span>
                        <span className="truncate font-medium">{source.note.title || 'Untitled'}</span>
                      </button>
                    </div>
                  );
                })}

                {selectedNodeEdges.outgoing.length === 0 && selectedNodeEdges.incoming.length === 0 && (
                  <p className="text-xs text-stone-400 italic">No connections yet.</p>
                )}
              </div>
            </div>

            {/* Suggested Connections inside Inspector */}
            {selectedSuggestions.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Suggested Connections</span>
                </div>
                {selectedSuggestions.map((s) => (
                  <div
                    key={`sug-${s.note.id}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{s.note.title || 'Untitled'}</div>
                      <div className="text-[10px] text-stone-500 truncate">{s.reason}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await connectNotes(selectedNode.id, s.note.id, s.suggestedRole);
                        await loadGraphNotes();
                      }}
                      className="px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-[11px] shrink-0 cursor-pointer"
                    >
                      + Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
