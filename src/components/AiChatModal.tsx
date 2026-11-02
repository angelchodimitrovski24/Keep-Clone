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
  FileCode,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  HardDrive,
  Settings,
  Cpu,
  ChevronDown,
  ArrowRight,
  Square,
  Play,
  Layers,
  FileDown,
  ExternalLink,
  MessageSquare,
  Zap,
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
} from '@/lib/ollamaClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Note } from '@/types/note';

export const AiChatModal: React.FC = () => {
  const {
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

  // Chat State
  const [messages, setMessages] = useState<OllamaChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<OllamaAttachedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [savedNoteMessageId, setSavedNoteMessageId] = useState<string | null>(null);
  const [appendedNoteMessageId, setAppendedNoteMessageId] = useState<string | null>(null);

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

  // Load config on mount
  useEffect(() => {
    const config = getSavedOllamaConfig();
    setBaseUrl(config.baseUrl || 'http://127.0.0.1:11434');
    setSelectedModel(config.selectedModel || '');
  }, []);

  // Check Ollama status on open or baseUrl change
  const refreshStatus = async (customUrl?: string) => {
    setIsCheckingStatus(true);
    setModelActionError(null);
    const url = customUrl || baseUrl;
    const res = await checkOllamaStatus(url);
    setIsCheckingStatus(false);
    setIsConnected(res.isRunning);
    setServerVersion(res.version || null);
    setInstalledModels(res.models);
    setCanAutoStart(Boolean(res.canAutoStart));

    if (res.isRunning && res.models.length > 0) {
      // If current selectedModel is not in installed list, pick the first available
      setSelectedModel((prev) => {
        if (prev && res.models.some((m) => m.name === prev)) {
          return prev;
        }
        const defaultChoice = res.models[0].name;
        saveOllamaConfig({ selectedModel: defaultChoice });
        return defaultChoice;
      });
    }
  };

  useEffect(() => {
    if (isAiChatModalOpen) {
      refreshStatus();
    }
  }, [isAiChatModalOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Auto-start server helper
  const handleStartOllama = async () => {
    setIsStartingServer(true);
    setModelActionError(null);
    const res = await startOllamaServer();
    setIsStartingServer(false);
    if (res.success) {
      setModelActionSuccess(res.message);
      await refreshStatus();
    } else {
      setModelActionError(res.message);
    }
  };

  // Change active model
  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName);
    saveOllamaConfig({ selectedModel: modelName });
  };

  // Pull model
  const handlePullModel = async (targetName: string) => {
    const clean = targetName.trim();
    if (!clean) return;

    setPullingModelName(clean);
    setPullProgressStatus('Connecting to Ollama...');
    setPullProgressPercent(0);
    setModelActionError(null);
    setModelActionSuccess(null);

    const res = await pullOllamaModel(
      clean,
      (status, percent) => {
        setPullProgressStatus(status);
        if (typeof percent === 'number') {
          setPullProgressPercent(percent);
        }
      },
      baseUrl
    );

    setPullingModelName(null);
    setPullProgressPercent(undefined);

    if (res.success) {
      setModelActionSuccess(`Model '${clean}' pulled successfully!`);
      setCustomModelInput('');
      await refreshStatus();
      handleSelectModel(clean);
    } else {
      setModelActionError(res.error || `Failed to pull model ${clean}`);
    }
  };

  // Delete model
  const handleDeleteModel = async (nameToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete local model '${nameToDelete}'?`)) {
      return;
    }
    setModelActionError(null);
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
        // Read image as base64
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
        // Read text / code / document as text
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
    // Reset file input
    e.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Send message or generate response
  const handleSendMessage = async (customPrompt?: string, noteInstruction?: string) => {
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

    // Construct user message
    const userMsg: OllamaChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachedFiles: currentFiles.length > 0 ? currentFiles : undefined,
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
      // Build LLM context payload
      const llmMessages: Array<{ role: string; content: string; images?: string[] }> = [];

      // If chatting about a note, prepend note context in system message
      let systemPrompt =
        'You are a helpful, brilliant AI assistant embedded in Google Keep Clone. Format your responses with clean, readable Markdown.';

      if (aiChatTargetNote) {
        const cleanContent = (aiChatTargetNote.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        systemPrompt = `You are an AI assistant specialized in analyzing and chatting about the following Google Keep Note:
Title: "${aiChatTargetNote.title || 'Untitled'}"
Category: ${aiChatTargetNote.category || 'None'}
Labels: ${(aiChatTargetNote.labels || []).join(', ') || 'None'}
Note Content:
"""
${cleanContent}
"""
Always reference this note accurately. Provide concise, clear markdown formatting.`;
      }

      // Convert conversation history
      for (const m of newMessages) {
        let contentWithFiles = m.content;
        const images: string[] = [];

        if (m.attachedFiles && m.attachedFiles.length > 0) {
          const fileContexts: string[] = [];
          for (const f of m.attachedFiles) {
            if (f.isImage) {
              // Extract base64 without prefix data:...;base64,
              const cleanB64 = f.content.replace(/^data:image\/[a-z]+;base64,/, '');
              images.push(cleanB64);
              fileContexts.push(`[Attached Image: ${f.name}]`);
            } else {
              fileContexts.push(`\n--- Attached File: ${f.name} ---\n${f.content.slice(0, 15000)}\n--- End File ---\n`);
            }
          }
          contentWithFiles = `${fileContexts.join('\n')}\n${m.content}`;
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
      if (err?.name === 'AbortError') {
        // User stopped generation
      } else {
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

  // Quick action for Note (Summarize, Action items, etc.)
  const handleRunNoteAction = (style: 'bullet' | 'concise' | 'action_items' | 'comprehensive' | 'translate') => {
    if (!aiChatTargetNote) return;
    const { user } = buildNoteSummaryPrompt(aiChatTargetNote, style);
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
    const title = aiChatTargetNote
      ? `AI Summary: ${aiChatTargetNote.title || 'Note'}`
      : `AI Note (${new Date().toLocaleDateString()})`;

    await addNote({
      title,
      content,
      category: aiChatTargetNote?.category || null,
      labels: aiChatTargetNote?.labels ? [...aiChatTargetNote.labels, 'AI-Summary'] : ['AI'],
    });

    setSavedNoteMessageId(msgId);
    setTimeout(() => setSavedNoteMessageId(null), 2500);
  };

  // Append AI response into the current target note
  const handleAppendToCurrentNote = async (msgId: string, content: string) => {
    if (!aiChatTargetNote) return;
    const updatedContent = `${aiChatTargetNote.content || ''}\n\n---\n### 🦙 AI Summary (${selectedModel})\n${content}\n`;
    await updateNote(aiChatTargetNote.id, { content: updatedContent }, 'Appended AI Summary');

    setAppendedNoteMessageId(msgId);
    setTimeout(() => setAppendedNoteMessageId(null), 2500);
  };

  if (!isAiChatModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-4xl h-[90vh] max-h-[850px] bg-white dark:bg-[#1f2023] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden text-stone-900 dark:text-stone-100">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-[#1a1b1e]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  Local AI with Ollama
                </h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online {serverVersion ? `(v${serverVersion})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Offline
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                100% private, on-device intelligence via local GPU & Ollama
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Model Selector Dropdown in Header */}
            {isConnected && installedModels.length > 0 && activeTab === 'chat' && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-200/60 dark:bg-stone-800/60 border border-stone-300/50 dark:border-stone-700/50 text-xs">
                <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <select
                  value={selectedModel}
                  onChange={(e) => handleSelectModel(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[150px] truncate text-stone-800 dark:text-stone-200"
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
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-white dark:bg-[#25262b] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat & Assistant</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('models')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'models'
                    ? 'bg-white dark:bg-[#25262b] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Models ({installedModels.length})</span>
              </button>
            </div>

            {/* Close Modal */}
            <button
              type="button"
              onClick={() => setIsAiChatModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY TAB 1: CHAT & NOTE ASSISTANT */}
        {activeTab === 'chat' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Note Context Banner if opened for a specific note */}
            {aiChatTargetNote && (
              <div className="px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-[10px] shrink-0 uppercase tracking-wide">
                    Note Focus
                  </span>
                  <span className="text-xs font-semibold text-amber-950 dark:text-amber-200 truncate">
                    {aiChatTargetNote.title || 'Untitled Note'}
                  </span>
                  <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70 hidden sm:inline">
                    ({(aiChatTargetNote.content || '').length} chars)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => handleRunNoteAction('bullet')}
                    disabled={isGenerating}
                    className="px-2.5 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span>📝 Bullet Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunNoteAction('action_items')}
                    disabled={isGenerating}
                    className="px-2.5 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1"
                  >
                    <span>✅ Action Items</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunNoteAction('concise')}
                    disabled={isGenerating}
                    className="px-2.5 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors shrink-0"
                  >
                    <span>⚡ Executive Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunNoteAction('translate')}
                    disabled={isGenerating}
                    className="px-2.5 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors shrink-0"
                  >
                    <span>🌐 Translate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiChatTargetNote(null)}
                    className="p-1 rounded-md text-amber-800 dark:text-amber-400 hover:bg-amber-500/20 transition-colors ml-1"
                    title="Switch to general chat (clear note focus)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* If Ollama Offline Warning Banner */}
            {!isConnected && (
              <div className="p-3 sm:px-6 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Ollama server is not running at {baseUrl}.</span>
                  <span className="hidden sm:inline">Start it locally or check models in settings.</span>
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Bot className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                      {aiChatTargetNote ? `Chat about "${aiChatTargetNote.title || 'Note'}"` : 'Ask Anything with Local AI'}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                      {aiChatTargetNote
                        ? 'Summarize, rewrite, ask questions, or extract tasks from this note.'
                        : 'Ask questions, attach files, brainstorm, or write code. Powered entirely by your local Ollama engine.'}
                    </p>
                  </div>

                  {/* Starter Prompts */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
                    {aiChatTargetNote ? (
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
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">✅ Extract Action Items</span>
                          <span className="text-[11px] text-stone-500">Checklist of todos & follow-ups</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('What are the key takeaways and missing details in this note?')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">🔍 Key Insights</span>
                          <span className="text-[11px] text-stone-500">Find insights & gaps</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('Rewrite and polish this note into clean professional language.')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">✨ Polish & Rewrite</span>
                          <span className="text-[11px] text-stone-500">Refine language & grammar</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('Explain how local LLMs and Ollama work in simple terms.')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">💡 Explain Concept</span>
                          <span className="text-[11px] text-stone-500">How Ollama & LLMs work</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('Give me 5 actionable productivity tips for note-taking and knowledge management.')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">🚀 Productivity</span>
                          <span className="text-[11px] text-stone-500">Note-taking tips & methods</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage('Draft an executive status report template with key milestones and risks.')}
                          className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-500/50 bg-stone-50 dark:bg-[#1a1b1e] text-xs text-stone-700 dark:text-stone-300 transition-colors"
                        >
                          <span className="font-semibold block text-stone-900 dark:text-stone-100">📊 Draft Report</span>
                          <span className="text-[11px] text-stone-500">Status report template</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 text-xs text-amber-900 dark:text-amber-200 transition-colors"
                        >
                          <span className="font-semibold block flex items-center gap-1">
                            <Paperclip className="w-3.5 h-3.5" /> Attach File & Ask
                          </span>
                          <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70">Upload text, code, or images</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-stone-400">
                      {msg.role === 'user' ? (
                        <span>You</span>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <Bot className="w-3.5 h-3.5" /> {selectedModel || 'Ollama AI'}
                        </span>
                      )}
                      <span>·</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-amber-500 text-white rounded-tr-xs'
                          : 'bg-stone-100 dark:bg-[#25262b] text-stone-900 dark:text-stone-100 border border-stone-200 dark:border-stone-800 rounded-tl-xs'
                      }`}
                    >
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

                      {/* Content */}
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm">
                          {msg.content ? (
                            <MarkdownRenderer content={msg.content} />
                          ) : isGenerating ? (
                            <div className="flex items-center gap-2 text-stone-400 py-1">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span className="text-xs">Thinking & generating...</span>
                            </div>
                          ) : (
                            <span className="text-stone-400 italic">(Empty response)</span>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>

                    {/* Actions for Assistant Message */}
                    {msg.role === 'assistant' && msg.content && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-1">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="px-2 py-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-[11px] text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors flex items-center gap-1"
                          title="Copy response to clipboard"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Insert into Note if target note exists */}
                        {aiChatTargetNote && (
                          <button
                            type="button"
                            onClick={() => handleAppendToCurrentNote(msg.id, msg.content)}
                            className="px-2 py-1 rounded-md hover:bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400 transition-colors flex items-center gap-1 font-medium"
                            title="Insert this response into the current note"
                          >
                            {appendedNoteMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Appended to note!</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Insert into Note</span>
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
                ))
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
                    <span className="text-[10px] text-stone-400">
                      ({(f.size / 1024).toFixed(0)} KB)
                    </span>
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

            {/* CHAT INPUT BAR */}
            <div className="p-3 sm:p-4 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1f2023] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2"
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
                  className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors shrink-0"
                  title="Attach file (text, code, json, csv, image)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Input Textarea */}
                <div className="flex-1 relative">
                  <textarea
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
                      aiChatTargetNote
                        ? `Ask anything about "${aiChatTargetNote.title || 'this note'}"...`
                        : 'Ask a question or request anything (Shift+Enter for new line)...'
                    }
                    className="w-full resize-none max-h-32 min-h-[42px] px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#1a1b1e] text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  />
                </div>

                {/* Clear Chat Button */}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-rose-500 transition-colors shrink-0"
                    title="Clear chat history"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}

                {/* Send or Stop Button */}
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs transition-colors shrink-0 flex items-center justify-center"
                    title="Stop generation"
                  >
                    <Square className="w-5 h-5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputPrompt.trim() && attachedFiles.length === 0}
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold shadow-xs transition-colors shrink-0 flex items-center justify-center"
                    title="Send message (Enter)"
                  >
                    <Send className="w-5 h-5" />
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
