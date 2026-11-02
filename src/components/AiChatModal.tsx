'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  Paperclip,
  Trash2,
  Copy,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Cpu,
  Layers,
  FileDown,
  ExternalLink,
  MessageSquare,
  Square,
  Play,
  Settings,
  BookOpen,
  Maximize2,
  Minimize2,
  Undo2,
  CheckCircle2,
  Pencil,
  PlusCircle,
  Search,
  FileEdit,
  ArrowRight,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';
import {
  OllamaModelInfo,
  OllamaChatMessage,
  OllamaAttachedFile,
  POPULAR_OLLAMA_MODELS,
  getSavedOllamaConfig,
  saveOllamaConfig,
  checkOllamaStatus,
  startOllamaServer,
  pullOllamaModel,
  deleteOllamaModel,
  streamOllamaChat,
  buildNoteSummaryPrompt,
  detectReferencedNote,
  parseNoteUpdateBlock,
  buildNoteContextPrompt,
} from '@/lib/ollamaClient';
import { convertMarkdownToHtml } from '@/lib/formatUtils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Note } from '@/types/note';

export const AiChatModal: React.FC = () => {
  const {
    notes,
    isAiChatModalOpen,
    setIsAiChatModalOpen,
    aiChatTargetNote,
    setAiChatTargetNote,
    addNote,
    updateNote,
  } = useKeep();

  // Active Tab: 'chat' | 'models'
  const [activeTab, setActiveTab] = useState<'chat' | 'models'>('chat');

  // Ollama Config State
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434');
  const [selectedModel, setSelectedModel] = useState('');
  const [installedModels, setInstalledModels] = useState<OllamaModelInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [canAutoStart, setCanAutoStart] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Chat State (Continuous Multi-messaging)
  const [messages, setMessages] = useState<OllamaChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<OllamaAttachedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [savedNoteMessageId, setSavedNoteMessageId] = useState<string | null>(null);
  const [appendedNoteMessageId, setAppendedNoteMessageId] = useState<string | null>(null);

  // Referenced Note & Update State
  const [activeReferencedNote, setActiveReferencedNote] = useState<Note | null>(null);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [notePickerSearch, setNotePickerSearch] = useState('');
  const [isExpandedInput, setIsExpandedInput] = useState(false);
  const [appliedUpdates, setAppliedUpdates] = useState<
    Record<string, { noteId: string; previousContent: string; previousTitle: string }>
  >({});
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  // Pulling Model State
  const [customModelInput, setCustomModelInput] = useState('');
  const [pullingModelName, setPullingModelName] = useState<string | null>(null);
  const [pullProgressStatus, setPullProgressStatus] = useState<string>('');
  const [pullProgressPercent, setPullProgressPercent] = useState<number | undefined>(undefined);
  const [modelActionError, setModelActionError] = useState<string | null>(null);
  const [modelActionSuccess, setModelActionSuccess] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notePickerRef = useRef<HTMLDivElement>(null);

  // Sync active target note from KeepContext
  useEffect(() => {
    if (aiChatTargetNote) {
      setActiveReferencedNote(aiChatTargetNote);
    }
  }, [aiChatTargetNote]);

  // Load config on mount
  useEffect(() => {
    const config = getSavedOllamaConfig();
    setBaseUrl(config.baseUrl || 'http://127.0.0.1:11434');
    setSelectedModel(config.selectedModel || '');
  }, []);

  // Poll Ollama status when modal is open
  const refreshStatus = async (customBaseUrl?: string) => {
    setIsCheckingStatus(true);
    const targetUrl = customBaseUrl || baseUrl;
    const res = await checkOllamaStatus(targetUrl);
    setIsConnected(res.isRunning);
    setServerVersion(res.version || null);
    setInstalledModels(res.models);
    setCanAutoStart(Boolean(res.canAutoStart));

    // Auto-select first model if none selected
    if (res.models.length > 0 && !selectedModel) {
      const preferred =
        res.models.find((m) => m.name.includes('llama3.2') || m.name.includes('gemma4') || m.name.includes('llama3')) ||
        res.models[0];
      setSelectedModel(preferred.name);
      saveOllamaConfig({ selectedModel: preferred.name });
    }

    setIsCheckingStatus(false);
  };

  useEffect(() => {
    if (isAiChatModalOpen) {
      refreshStatus();
    }
  }, [isAiChatModalOpen]);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Auto-expand textarea height based on content
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = isExpandedInput ? 360 : 200;
      const nextHeight = Math.min(Math.max(scrollHeight, 44), maxHeight);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputPrompt, isExpandedInput]);

  // Close note picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notePickerRef.current && !notePickerRef.current.contains(e.target as Node)) {
        setShowNotePicker(false);
      }
    };
    if (showNotePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotePicker]);

  // Filter notes for note picker
  const filteredNotes = useMemo(() => {
    const activeNotes = (notes || []).filter((n) => !n.isTrash);
    if (!notePickerSearch.trim()) return activeNotes.slice(0, 15);
    const q = notePickerSearch.toLowerCase();
    return activeNotes
      .filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
      .slice(0, 20);
  }, [notes, notePickerSearch]);

  // Handle Model Selection
  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName);
    saveOllamaConfig({ selectedModel: modelName });
  };

  // Start local Ollama server process
  const handleStartOllama = async () => {
    setIsStartingServer(true);
    const res = await startOllamaServer();
    if (res.success) {
      await refreshStatus();
    } else {
      alert(`Could not start Ollama automatically: ${res.message || 'Check local installation.'}`);
    }
    setIsStartingServer(false);
  };

  // Pull / Download a Model
  const handlePullModel = async (modelName: string) => {
    if (!modelName.trim()) return;
    setPullingModelName(modelName.trim());
    setPullProgressStatus('Connecting to Ollama library...');
    setPullProgressPercent(undefined);
    setModelActionError(null);
    setModelActionSuccess(null);

    const res = await pullOllamaModel(
      modelName.trim(),
      (status, percent) => {
        setPullProgressStatus(status);
        if (percent !== undefined) setPullProgressPercent(percent);
      },
      baseUrl
    );

    if (res.success) {
      setModelActionSuccess(`Model '${modelName}' installed successfully!`);
      setSelectedModel(modelName.trim());
      saveOllamaConfig({ selectedModel: modelName.trim() });
      setCustomModelInput('');
      await refreshStatus();
    } else {
      setModelActionError(res.error || 'Failed to download model');
    }

    setPullingModelName(null);
    setPullProgressStatus('');
    setPullProgressPercent(undefined);
  };

  // Delete an installed model
  const handleDeleteModel = async (nameToDelete: string) => {
    if (!confirm(`Are you sure you want to delete model '${nameToDelete}' to free up disk space?`)) return;
    const res = await deleteOllamaModel(nameToDelete, baseUrl);
    if (res.success) {
      setModelActionSuccess(`Model '${nameToDelete}' deleted.`);
      await refreshStatus();
    } else {
      setModelActionError(res.error || 'Failed to delete model');
    }
  };

  // Handle file attachment
  const handleAttachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: OllamaAttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = file.type.startsWith('image/');

      if (isImg) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          content: base64,
          isImage: true,
        });
      } else {
        const textContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => resolve(`[Failed reading file ${file.name}]`);
          reader.readAsText(file);
        });
        newAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          content: textContent,
          isImage: false,
        });
      }
    }

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Start a fresh conversation (reset history)
  const handleNewConversation = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setInputPrompt('');
    setAttachedFiles([]);
    setUpdateFeedback(null);
  };

  // Send message or generate response (Continuous conversation)
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt !== undefined ? customPrompt : inputPrompt).trim();
    if (!textToSend && attachedFiles.length === 0) return;
    if (!selectedModel) {
      alert('Please select or pull an Ollama model first in the Models tab.');
      setActiveTab('models');
      return;
    }

    const currentFiles = [...attachedFiles];
    setInputPrompt('');
    setAttachedFiles([]);
    setShowNotePicker(false);

    // Resolve target note: either from active reference, or auto-detected by link/title/mention
    let targetNote: Note | null = activeReferencedNote || aiChatTargetNote;
    const detected = detectReferencedNote(textToSend, notes);
    if (detected) {
      targetNote = detected.note;
      setActiveReferencedNote(detected.note);
    }

    // Construct user message
    const userMsg: OllamaChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachedFiles: currentFiles.length > 0 ? currentFiles : undefined,
      referencedNote: targetNote
        ? {
            id: targetNote.id,
            title: targetNote.title || 'Untitled Note',
            category: targetNote.category,
          }
        : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    // Prepare assistant placeholder message
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: OllamaChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...newMessages, assistantMsg]);
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Build LLM context payload with full conversation history
      const llmMessages: Array<{ role: string; content: string; images?: string[] }> = [];

      // System Prompt with Note Intelligence and Update Instructions
      let systemPrompt = `You are a brilliant, highly capable AI assistant embedded inside Google Keep Clone.
You have full memory of the continuous conversation and can analyze, summarize, write, and update Google Keep notes.
Format your responses with clean, readable Markdown.

NOTE UPDATE INSTRUCTIONS:
If the user asks you to update, edit, rewrite, expand, add tasks to, or modify a note:
1. Provide a concise explanation or summary of your changes in normal text.
2. Put the COMPLETE updated note content inside a dedicated block formatted exactly like this:
\`\`\`note-update
title: [Updated Note Title, or keep the existing title]
---
[Complete updated note content in clean markdown format]
\`\`\`
The user will be able to apply your changes directly to the note with a single click.`;

      if (targetNote) {
        systemPrompt += `\n\n${buildNoteContextPrompt(targetNote)}`;
      }

      // Convert conversation history for multi-turn messaging
      for (const m of newMessages) {
        let contentWithFiles = m.content;
        const images: string[] = [];

        // If turn has attached note context
        if (m.referencedNote && m.role === 'user') {
          const noteObj = notes.find((n) => n.id === m.referencedNote?.id);
          if (noteObj) {
            contentWithFiles = `${buildNoteContextPrompt(noteObj)}\n\n${contentWithFiles}`;
          }
        }

        if (m.attachedFiles && m.attachedFiles.length > 0) {
          const fileContexts: string[] = [];
          for (const f of m.attachedFiles) {
            if (f.isImage) {
              const cleanB64 = f.content.replace(/^data:image\/[a-z]+;base64,/, '');
              images.push(cleanB64);
              fileContexts.push(`[Attached Image: ${f.name}]`);
            } else {
              fileContexts.push(`\n--- Attached File: ${f.name} ---\n${f.content.slice(0, 15000)}\n--- End File ---\n`);
            }
          }
          contentWithFiles = `${fileContexts.join('\n')}\n${contentWithFiles}`;
        }

        llmMessages.push({
          role: m.role,
          content: contentWithFiles,
          images: images.length > 0 ? images : undefined,
        });
      }

      let accumulated = '';
      await streamOllamaChat(
        selectedModel,
        llmMessages,
        (chunk) => {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg))
          );
        },
        {
          system: systemPrompt,
          baseUrl,
          signal: abortController.signal,
        }
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: `⚠️ Error from Ollama: ${err?.message || 'Failed generating response'}` }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Quick action for Note
  const handleRunNoteAction = (style: 'bullet' | 'concise' | 'action_items' | 'comprehensive' | 'translate') => {
    const target = activeReferencedNote || aiChatTargetNote;
    if (!target) return;
    const { user } = buildNoteSummaryPrompt(target, style);
    handleSendMessage(user);
  };

  // Stop Generation
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Copy message
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Save AI response as a new Note
  const handleSaveAsNewNote = async (msgId: string, content: string) => {
    const target = activeReferencedNote || aiChatTargetNote;
    const title = target ? `AI: ${target.title || 'Note'}` : `AI Note (${new Date().toLocaleDateString()})`;

    // If there's an update block, extract clean content
    const parsedUpdate = parseNoteUpdateBlock(content);
    const textToSave = parsedUpdate ? parsedUpdate.proposedContent : content;
    const html = convertMarkdownToHtml(textToSave);

    await addNote({
      title: parsedUpdate?.proposedTitle || title,
      content: html,
      category: target?.category || null,
      labels: target?.labels ? [...target.labels, 'AI-Summary'] : ['AI'],
    });

    setSavedNoteMessageId(msgId);
    setTimeout(() => setSavedNoteMessageId(null), 2500);
  };

  // Append AI response into the active/target note
  const handleAppendToCurrentNote = async (msgId: string, content: string) => {
    const target = activeReferencedNote || aiChatTargetNote;
    if (!target) return;

    const parsedUpdate = parseNoteUpdateBlock(content);
    const textToAppend = parsedUpdate ? parsedUpdate.proposedContent : content;
    const htmlAppend = convertMarkdownToHtml(textToAppend);

    const updatedContent = `${target.content || ''}\n\n<hr />\n<p><strong>🦙 AI Update (${selectedModel}):</strong></p>\n${htmlAppend}`;
    await updateNote(target.id, { content: updatedContent }, 'Appended AI response');

    setAppendedNoteMessageId(msgId);
    setUpdateFeedback(`Appended to note "${target.title || 'Untitled'}"!`);
    setTimeout(() => {
      setAppendedNoteMessageId(null);
      setUpdateFeedback(null);
    }, 3500);
  };

  // Apply Full Update to Note (Replaces note content with proposed changes)
  const handleApplyNoteUpdate = async (
    msgId: string,
    targetNote: Note,
    proposedContent: string,
    proposedTitle?: string
  ) => {
    // Save previous state for Undo
    setAppliedUpdates((prev) => ({
      ...prev,
      [msgId]: {
        noteId: targetNote.id,
        previousContent: targetNote.content || '',
        previousTitle: targetNote.title || '',
      },
    }));

    const cleanHtml = convertMarkdownToHtml(proposedContent);
    const updates: Partial<Note> = {
      content: cleanHtml,
    };
    if (proposedTitle && proposedTitle !== targetNote.title) {
      updates.title = proposedTitle;
    }

    await updateNote(targetNote.id, updates, 'Updated by Ollama AI');

    setUpdateFeedback(`Updated note "${proposedTitle || targetNote.title || 'Untitled'}" successfully!`);
    setTimeout(() => setUpdateFeedback(null), 4000);
  };

  // Revert / Undo Note Update
  const handleUndoNoteUpdate = async (msgId: string) => {
    const record = appliedUpdates[msgId];
    if (!record) return;

    await updateNote(
      record.noteId,
      {
        content: record.previousContent,
        title: record.previousTitle,
      },
      'Reverted AI Note update'
    );

    setAppliedUpdates((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });

    setUpdateFeedback(`Reverted note to previous state.`);
    setTimeout(() => setUpdateFeedback(null), 3000);
  };

  if (!isAiChatModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-4xl h-[92vh] max-h-[880px] bg-white dark:bg-[#1f2023] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden text-stone-900 dark:text-stone-100">
        {/* HEADER */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-[#1a1b1e]/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 truncate">
                  Ollama Local AI
                </h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Offline
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate hidden sm:block">
                Continuous chat, multi-line prompts, note references & 1-click note updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Model Selector Dropdown in Header */}
            {isConnected && installedModels.length > 0 && activeTab === 'chat' && (
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-200/60 dark:bg-stone-800/60 border border-stone-300/50 dark:border-stone-700/50 text-xs">
                <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <select
                  value={selectedModel}
                  onChange={(e) => handleSelectModel(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[140px] truncate text-stone-800 dark:text-stone-200"
                >
                  {installedModels.map((m) => (
                    <option key={m.name} value={m.name} className="dark:bg-[#1a1b1e]">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* TAB TOGGLES */}
            <div className="flex bg-stone-200/70 dark:bg-stone-800/80 p-0.5 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-white dark:bg-[#25262b] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat & Assistant</span>
                <span className="sm:hidden">Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('models')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'models'
                    ? 'bg-white dark:bg-[#25262b] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Models ({installedModels.length})</span>
              </button>
            </div>

            {/* New Conversation Button */}
            {activeTab === 'chat' && messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewConversation}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1"
                title="Start a fresh conversation (reset continuous chat)"
              >
                <PlusCircle className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">New Chat</span>
              </button>
            )}

            {/* Close Modal */}
            <button
              type="button"
              onClick={() => setIsAiChatModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors ml-0.5"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK TOAST / BANNER */}
        {updateFeedback && (
          <div className="px-4 py-2 bg-emerald-500 text-white text-xs font-medium flex items-center justify-between shrink-0 shadow-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{updateFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setUpdateFeedback(null)}
              className="p-0.5 hover:bg-white/20 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* BODY TAB 1: CHAT & NOTE ASSISTANT */}
        {activeTab === 'chat' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
            {/* Active Referenced / Focused Note Banner */}
            {activeReferencedNote && (
              <div className="px-4 sm:px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-[10px] shrink-0 uppercase tracking-wide flex items-center gap-1">
                    <FileEdit className="w-3 h-3" />
                    Target Note
                  </span>
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-200 truncate">
                    {activeReferencedNote.title || 'Untitled Note'}
                  </span>
                  {activeReferencedNote.category && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-200/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 hidden sm:inline">
                      {activeReferencedNote.category}
                    </span>
                  )}
                  <span className="text-[10px] text-amber-800/70 dark:text-amber-300/70 hidden md:inline">
                    (AI can summarize, chat, or update this note directly)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleRunNoteAction('bullet')}
                    disabled={isGenerating}
                    className="px-2 py-0.5 rounded-lg bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors shrink-0"
                  >
                    📝 Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunNoteAction('action_items')}
                    disabled={isGenerating}
                    className="px-2 py-0.5 rounded-lg bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors shrink-0"
                  >
                    ✅ Action Items
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        `Please improve, polish, and rewrite note "${activeReferencedNote.title}". Format your response inside a \`\`\`note-update block so I can apply it.`
                      )
                    }
                    disabled={isGenerating}
                    className="px-2 py-0.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 text-[11px] font-bold shadow-xs transition-colors shrink-0 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Rewrite & Update</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReferencedNote(null);
                      setAiChatTargetNote(null);
                    }}
                    className="p-1 rounded-md text-amber-800 dark:text-amber-400 hover:bg-amber-500/20 transition-colors ml-1"
                    title="Detach active note focus"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Offline Warning Banner */}
            {!isConnected && (
              <div className="p-3 sm:px-6 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Ollama server is offline at {baseUrl}.</span>
                  <span className="hidden sm:inline">Start it locally to begin chatting.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartOllama}
                    disabled={isStartingServer}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isStartingServer ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Start Ollama Server</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('models')}
                    className="px-2.5 py-1 rounded-lg bg-rose-200/60 dark:bg-rose-900/40 hover:bg-rose-200 text-rose-900 dark:text-rose-200 font-semibold transition-colors"
                  >
                    Setup
                  </button>
                </div>
              </div>
            )}

            {/* CHAT MESSAGES SCROLLER */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-lg mx-auto space-y-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                    <Bot className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                      {activeReferencedNote
                        ? `Chat & Edit "${activeReferencedNote.title || 'Note'}"`
                        : 'Local AI Continuous Assistant'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed max-w-sm mx-auto">
                      {activeReferencedNote
                        ? 'Summarize, ask questions, or ask the AI to rewrite and update this note.'
                        : 'Ask questions, attach files, reference any note by title or link, and have continuous conversations.'}
                    </p>
                  </div>

                  {/* Starter Prompts */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-left">
                    {activeReferencedNote ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRunNoteAction('bullet')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">📝 Summarize Note</span>
                          <span className="text-[11px] text-stone-500">Structured bullets of key points</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRunNoteAction('action_items')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">✅ Action Items</span>
                          <span className="text-[11px] text-stone-500">Extract todos as checkboxes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSendMessage(
                              `Rewrite and polish this note into clean professional language. Format your update inside a \`\`\`note-update block.`
                            )
                          }
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">✨ Polish & Propose Update</span>
                          <span className="text-[11px] text-stone-500">Refine language and apply directly</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSendMessage('What are the key takeaways, risks, and missing details in this note?')
                          }
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">🔍 Key Insights</span>
                          <span className="text-[11px] text-stone-500">Critical analysis & review</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowNotePicker(true)}
                          className="p-2.5 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 text-xs text-amber-900 dark:text-amber-200 transition-colors"
                        >
                          <span className="font-semibold block flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 text-amber-600" /> Reference a Note
                          </span>
                          <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                            Pick any note to chat or update
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 hover:border-stone-400 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block flex items-center gap-1">
                            <Paperclip className="w-3.5 h-3.5 text-stone-500" /> Attach File
                          </span>
                          <span className="text-[11px] text-stone-500">Upload text, code, or images</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('Give me 5 actionable productivity tips for personal knowledge management.')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">💡 Brainstorming</span>
                          <span className="text-[11px] text-stone-500">Productivity & note tips</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('Explain how Ollama runs LLMs completely offline on device.')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">🔒 Local Privacy</span>
                          <span className="text-[11px] text-stone-500">How local inference works</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const parsedUpdate = msg.role === 'assistant' ? parseNoteUpdateBlock(msg.content) : null;
                  const isApplied = Boolean(appliedUpdates[msg.id]);
                  const activeTarget = activeReferencedNote || aiChatTargetNote;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sender & Timestamp Header */}
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-stone-400">
                        {msg.role === 'user' ? (
                          <span className="font-medium">You</span>
                        ) : (
                          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <Bot className="w-3.5 h-3.5" /> {selectedModel || 'Ollama AI'}
                          </span>
                        )}
                        <span>·</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      {/* Bubble Content */}
                      <div
                        className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                          msg.role === 'user'
                            ? 'bg-amber-500 text-white rounded-tr-xs'
                            : 'bg-stone-100 dark:bg-[#25262b] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800 rounded-tl-xs'
                        }`}
                      >
                        {/* Referenced Note Badge in User Bubble */}
                        {msg.referencedNote && (
                          <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-white/20 text-xs font-semibold">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Referenced Note:</span>
                            <span className="underline decoration-white/40 truncate max-w-[200px]">
                              {msg.referencedNote.title}
                            </span>
                          </div>
                        )}

                        {/* Attached files pills in user bubble */}
                        {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-white/20">
                            {msg.attachedFiles.map((f, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-[11px] font-medium"
                              >
                                {f.isImage ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                <span className="max-w-[120px] truncate">{f.name}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Message Content */}
                        {msg.role === 'assistant' ? (
                          <div className="space-y-3">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm">
                              {msg.content ? (
                                <MarkdownRenderer content={msg.content} />
                              ) : isGenerating ? (
                                <div className="flex items-center gap-2 text-stone-400 py-1">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span className="text-xs">Generating continuous response...</span>
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">(Empty response)</span>
                              )}
                            </div>

                            {/* PROPOSED NOTE UPDATE CARD (if LLM output note-update block) */}
                            {parsedUpdate && activeTarget && (
                              <div className="mt-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-stone-900 dark:text-stone-100 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                                      Proposed Update for: "{parsedUpdate.proposedTitle || activeTarget.title || 'Note'}"
                                    </span>
                                  </div>
                                  {isApplied && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Applied
                                    </span>
                                  )}
                                </div>

                                <div className="p-2.5 rounded-lg bg-white/70 dark:bg-black/30 border border-amber-500/20 max-h-40 overflow-y-auto text-xs font-mono whitespace-pre-wrap">
                                  {parsedUpdate.proposedContent}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {!isApplied ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApplyNoteUpdate(
                                          msg.id,
                                          activeTarget,
                                          parsedUpdate.proposedContent,
                                          parsedUpdate.proposedTitle
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                                    >
                                      <FileEdit className="w-3.5 h-3.5" />
                                      <span>Apply Update to Note</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleUndoNoteUpdate(msg.id)}
                                      className="px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-semibold text-xs transition-colors flex items-center gap-1.5"
                                    >
                                      <Undo2 className="w-3.5 h-3.5" />
                                      <span>Undo Changes</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleAppendToCurrentNote(msg.id, parsedUpdate.proposedContent)}
                                    className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold text-amber-900 dark:text-amber-200 transition-colors flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Append Instead</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>

                      {/* Actions for Assistant Message */}
                      {msg.role === 'assistant' && msg.content && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 px-1">
                          {/* Copy button */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-[11px] text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors flex items-center gap-1"
                            title="Copy response to clipboard"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {/* Quick Overwrite / Update Note if active target note exists */}
                          {activeTarget && !parsedUpdate && (
                            <button
                              type="button"
                              onClick={() => handleApplyNoteUpdate(msg.id, activeTarget, msg.content)}
                              className="px-2 py-1 rounded-md hover:bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400 transition-colors flex items-center gap-1 font-medium"
                              title={`Update note "${activeTarget.title || 'Untitled'}" with this content`}
                            >
                              {appliedUpdates[msg.id] ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Note Updated!</span>
                                </>
                              ) : (
                                <>
                                  <Pencil className="w-3 h-3" />
                                  <span>Update Note</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Insert / Append into Note */}
                          {activeTarget && (
                            <button
                              type="button"
                              onClick={() => handleAppendToCurrentNote(msg.id, msg.content)}
                              className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-[11px] text-stone-600 dark:text-stone-300 transition-colors flex items-center gap-1"
                              title="Append this response to the current note"
                            >
                              {appendedNoteMessageId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Appended!</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Append</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Save as New Note */}
                          <button
                            type="button"
                            onClick={() => handleSaveAsNewNote(msg.id, msg.content)}
                            className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-[11px] text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors flex items-center gap-1"
                            title="Create a new note with this content"
                          >
                            {savedNoteMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Note created!</span>
                              </>
                            ) : (
                              <>
                                <FileDown className="w-3 h-3" />
                                <span>Save as Note</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ATTACHED FILES TRAY */}
            {attachedFiles.length > 0 && (
              <div className="px-4 py-2 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-[#1a1b1e]/70 flex flex-wrap gap-2 shrink-0">
                {attachedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#25262b] border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 shadow-2xs"
                  >
                    {f.isImage ? (
                      <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className="max-w-[140px] truncate font-medium">{f.name}</span>
                    <span className="text-[10px] text-stone-400">({(f.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(idx)}
                      className="p-0.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* FLOATING NOTE PICKER POPOVER */}
            {showNotePicker && (
              <div
                ref={notePickerRef}
                className="absolute bottom-20 left-4 right-4 sm:left-6 sm:w-96 max-h-80 bg-white dark:bg-[#25262b] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 p-3 z-30 flex flex-col space-y-2 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <span>Select Note to Reference:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotePicker(false)}
                    className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md text-stone-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    value={notePickerSearch}
                    onChange={(e) => setNotePickerSearch(e.target.value)}
                    placeholder="Search by title or content..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1b1e] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 max-h-48 pt-1">
                  {filteredNotes.length === 0 ? (
                    <p className="text-center py-4 text-xs text-stone-400">No matching notes found.</p>
                  ) : (
                    filteredNotes.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setActiveReferencedNote(n);
                          setAiChatTargetNote(n);
                          setShowNotePicker(false);
                          setNotePickerSearch('');
                        }}
                        className="w-full text-left p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/80 transition-colors flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-stone-900 dark:text-stone-100 block truncate">
                            {n.title || 'Untitled Note'}
                          </span>
                          <span className="text-[11px] text-stone-400 block truncate max-w-[240px]">
                            {(n.content || '').replace(/<[^>]+>/g, ' ').slice(0, 70)}
                          </span>
                        </div>
                        {n.category && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold shrink-0">
                            {n.category}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* CHAT INPUT BAR WITH MULTI-LINE SUPPORT */}
            <div className="p-3 sm:p-4 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1f2023] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-1.5 sm:gap-2"
              >
                {/* File Attachment Input (hidden) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.log,.pdf,image/*"
                  onChange={handleAttachFiles}
                  className="hidden"
                />

                {/* Attach File Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 sm:p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors shrink-0"
                  title="Attach file (text, code, json, csv, image)"
                >
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Reference Note Button */}
                <button
                  type="button"
                  onClick={() => setShowNotePicker((prev) => !prev)}
                  className={`p-2 sm:p-2.5 rounded-xl transition-colors shrink-0 flex items-center gap-1 ${
                    showNotePicker || activeReferencedNote
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                  }`}
                  title="Reference a note from Keep (or type @NoteTitle in chat)"
                >
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Input Textarea Container */}
                <div className="flex-1 relative flex flex-col">
                  {/* Referenced Note Pill above textarea */}
                  {activeReferencedNote && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[11px] font-semibold border border-amber-500/30">
                        <BookOpen className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span className="max-w-[200px] truncate">{activeReferencedNote.title || 'Untitled Note'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReferencedNote(null);
                            setAiChatTargetNote(null);
                          }}
                          className="hover:text-rose-500 ml-0.5 p-0.5"
                          title="Remove referenced note"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  )}

                  <div className="relative flex items-center">
                    <textarea
                      ref={textareaRef}
                      value={inputPrompt}
                      onChange={(e) => setInputPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={1}
                      placeholder={
                        activeReferencedNote
                          ? `Ask about or update "${activeReferencedNote.title || 'note'}" (Shift+Enter for newline)...`
                          : 'Ask anything, type @NoteTitle or paste note link (Shift+Enter for newline)...'
                      }
                      className="w-full resize-none min-h-[44px] max-h-56 px-3.5 py-2.5 pr-8 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1b1e] text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed overflow-y-auto"
                    />

                    {/* Expand/Collapse Textarea Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsExpandedInput((prev) => !prev)}
                      className="absolute right-2 top-3 p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                      title={isExpandedInput ? 'Collapse input' : 'Expand input for long text'}
                    >
                      {isExpandedInput ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Clear Chat Button */}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="p-2 sm:p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-rose-500 transition-colors shrink-0"
                    title="Clear chat messages"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                {/* Send or Stop Button */}
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    className="p-2 sm:p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs transition-colors shrink-0 flex items-center justify-center"
                    title="Stop generation"
                  >
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() && attachedFiles.length === 0}
                    className="p-2 sm:p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold shadow-xs transition-colors shrink-0 flex items-center justify-center"
                    title="Send message (Enter)"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* BODY TAB 2: OLLAMA MODELS & SETUP */}
        {activeTab === 'models' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Feedback Banners */}
            {modelActionError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between">
                <span>{modelActionError}</span>
                <button
                  type="button"
                  onClick={() => setModelActionError(null)}
                  className="p-1 hover:bg-rose-500/20 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {modelActionSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>{modelActionSuccess}</span>
                <button
                  type="button"
                  onClick={() => setModelActionSuccess(null)}
                  className="p-1 hover:bg-emerald-500/20 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* PULLING PROGRESS BAR */}
            {pullingModelName && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-950 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                    <span>Pulling Model: {pullingModelName}</span>
                  </div>
                  <span>{pullProgressPercent !== undefined ? `${pullProgressPercent}%` : 'In progress...'}</span>
                </div>
                <div className="w-full bg-amber-500/20 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${pullProgressPercent || 15}%` }}
                  />
                </div>
                <p className="text-[11px] font-mono text-amber-800 dark:text-amber-300 truncate">
                  {pullProgressStatus}
                </p>
              </div>
            )}

            {/* SECTION 1: INSTALLED MODELS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-amber-500" />
                    Installed Models ({installedModels.length})
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Select an active model to power summaries, chat, and question-answering.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshStatus()}
                  disabled={isCheckingStatus}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs text-stone-600 dark:text-stone-300 font-medium transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {installedModels.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-center text-xs text-stone-500 dark:text-stone-400 space-y-2">
                  <p>No Ollama models found locally.</p>
                  <p>Pull one of the recommended models below to get started in 1-click!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {installedModels.map((m) => {
                    const isSelected = selectedModel === m.name;
                    const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
                    const params = m.details?.parameter_size;
                    const quant = m.details?.quantization_level;

                    return (
                      <div
                        key={m.name}
                        onClick={() => handleSelectModel(m.name)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50 shadow-xs ring-1 ring-amber-500/30'
                            : 'bg-stone-50 dark:bg-[#1a1b1e] border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                              {m.name}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[9px] uppercase tracking-wide">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                            <span>{sizeGb} GB</span>
                            {params && <span>• {params}</span>}
                            {quant && <span>• {quant}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleSelectModel(m.name)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              isSelected
                                ? 'bg-amber-500 text-white'
                                : 'bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-700 dark:text-stone-300'
                            }`}
                          >
                            {isSelected ? 'Active' : 'Use'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(m.name)}
                            className="p-1 rounded-lg hover:bg-rose-500/10 text-stone-400 hover:text-rose-600 transition-colors"
                            title={`Delete model ${m.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: ONE-CLICK MODEL CATALOG */}
            <div className="space-y-3 pt-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-amber-500" />
                  Install Recommended Models (1-Click)
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Select and install tested models for your hardware. Faster models use less VRAM.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {POPULAR_OLLAMA_MODELS.map((item) => {
                  const isInstalled = installedModels.some(
                    (m) => m.name === item.name || m.name.startsWith(item.name.split(':')[0])
                  );
                  const isCurrentlyPulling = pullingModelName === item.name;

                  return (
                    <div
                      key={item.name}
                      className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#1a1b1e] flex flex-col justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-stone-900 dark:text-stone-100">{item.label}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold text-[9px]">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 dark:border-stone-800/60 text-[11px]">
                        <span className="font-mono text-stone-400">{item.sizeEstimate}</span>

                        {isInstalled ? (
                          <button
                            type="button"
                            onClick={() => handleSelectModel(item.name)}
                            className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Installed</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePullModel(item.name)}
                            disabled={Boolean(pullingModelName)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold shadow-xs transition-colors flex items-center gap-1"
                          >
                            {isCurrentlyPulling ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>Install</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 3: CUSTOM MODEL PULL INPUT */}
            <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-[#1a1b1e]/60 space-y-2">
              <label className="block text-xs font-bold text-stone-900 dark:text-stone-100">
                Install Any Model from Ollama Library:
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePullModel(customModelInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="e.g. codellama:7b, gemma4, llama3.2:3b, dolphin-mistral..."
                  disabled={Boolean(pullingModelName)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#25262b] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={!customModelInput.trim() || Boolean(pullingModelName)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull Model</span>
                </button>
              </form>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Browse hundreds of models on{' '}
                <a
                  href="https://ollama.com/library"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
                >
                  ollama.com/library <ExternalLink className="w-3 h-3 inline" />
                </a>
              </p>
            </div>

            {/* SECTION 4: SERVER CONFIGURATION */}
            <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-[#1a1b1e]/60 space-y-3">
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-stone-500" />
                Ollama Server Settings
              </h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value);
                    saveOllamaConfig({ baseUrl: e.target.value });
                  }}
                  placeholder="http://127.0.0.1:11434"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#25262b] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => refreshStatus(baseUrl)}
                  className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors shrink-0"
                >
                  Test Connection
                </button>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Default: <code>http://127.0.0.1:11434</code>. You can also point to a remote server or Docker container.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
