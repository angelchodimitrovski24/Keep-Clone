import { Note } from '@/types/note';

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModelInfo {
  name: string;
  model?: string;
  modified_at?: string;
  size: number;
  digest?: string;
  details?: OllamaModelDetails;
}

export interface OllamaAttachedFile {
  name: string;
  size: number;
  type: string;
  content: string; // extracted text or base64 data
  isImage?: boolean;
}

export interface OllamaChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachedFiles?: OllamaAttachedFile[];
}

export interface OllamaConfig {
  baseUrl: string;
  selectedModel: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface OllamaCatalogItem {
  name: string;
  tag: string;
  label: string;
  description: string;
  sizeEstimate: string;
  category: 'Fast' | 'Balanced' | 'Reasoning' | 'Vision' | 'Code';
  badge?: string;
}

export const POPULAR_OLLAMA_MODELS: OllamaCatalogItem[] = [
  {
    name: 'llama3.2:1b',
    tag: '1b',
    label: 'Llama 3.2 (1B)',
    description: 'Ultra-fast and lightweight. Perfect for low VRAM & quick note summaries.',
    sizeEstimate: '~1.3 GB',
    category: 'Fast',
    badge: 'Fastest',
  },
  {
    name: 'llama3.2:3b',
    tag: '3b',
    label: 'Llama 3.2 (3B)',
    description: 'Great balance of speed, reasoning, and summarization quality.',
    sizeEstimate: '~2.0 GB',
    category: 'Balanced',
    badge: 'Recommended',
  },
  {
    name: 'gemma4:latest',
    tag: 'latest',
    label: 'Gemma 4',
    description: "Google's lightweight, capable open model for creative writing & answers.",
    sizeEstimate: '~2.5 GB',
    category: 'Balanced',
    badge: 'Google',
  },
  {
    name: 'llama3:latest',
    tag: 'latest',
    label: 'Llama 3 (8B)',
    description: 'State-of-the-art reasoning, deep synthesis, and extensive knowledge.',
    sizeEstimate: '~4.7 GB',
    category: 'Reasoning',
    badge: 'Meta',
  },
  {
    name: 'deepseek-r1:1.5b',
    tag: '1.5b',
    label: 'DeepSeek R1 (1.5B)',
    description: 'High-speed reasoning and step-by-step problem solving in tiny footprint.',
    sizeEstimate: '~1.1 GB',
    category: 'Reasoning',
    badge: 'Reasoning',
  },
  {
    name: 'deepseek-r1:7b',
    tag: '7b',
    label: 'DeepSeek R1 (7B)',
    description: 'Full chain-of-thought reasoning, math, and analytical synthesis.',
    sizeEstimate: '~4.7 GB',
    category: 'Reasoning',
    badge: 'Chain-of-Thought',
  },
  {
    name: 'mistral:latest',
    tag: 'latest',
    label: 'Mistral (7B)',
    description: 'Fast, instruction-tuned language model with excellent formatting.',
    sizeEstimate: '~4.1 GB',
    category: 'Balanced',
    badge: 'Mistral AI',
  },
  {
    name: 'phi3:mini',
    tag: 'mini',
    label: 'Microsoft Phi-3 Mini',
    description: 'Compact 3.8B model with strong logic, reasoning, and coding.',
    sizeEstimate: '~2.2 GB',
    category: 'Fast',
    badge: 'Microsoft',
  },
  {
    name: 'qwen2.5:3b',
    tag: '3b',
    label: 'Qwen 2.5 (3B)',
    description: 'Alibaba versatile model with exceptional multilingual & markdown skills.',
    sizeEstimate: '~1.9 GB',
    category: 'Balanced',
    badge: 'Multilingual',
  },
  {
    name: 'llava:latest',
    tag: 'latest',
    label: 'LLaVA (Vision)',
    description: 'Multimodal model for analyzing attached images and photos with text.',
    sizeEstimate: '~4.5 GB',
    category: 'Vision',
    badge: 'Multimodal',
  },
];

const OLLAMA_CONFIG_KEY = 'keep_ollama_config';

export function getSavedOllamaConfig(): OllamaConfig {
  const defaults: OllamaConfig = {
    baseUrl: 'http://127.0.0.1:11434',
    selectedModel: '',
    temperature: 0.7,
  };

  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(OLLAMA_CONFIG_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveOllamaConfig(config: Partial<OllamaConfig>): OllamaConfig {
  const current = getSavedOllamaConfig();
  const updated = { ...current, ...config };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(OLLAMA_CONFIG_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save Ollama config:', err);
    }
  }
  return updated;
}

/**
 * Checks if Ollama is running and retrieves version + installed models
 */
export async function checkOllamaStatus(baseUrl?: string): Promise<{
  isRunning: boolean;
  version?: string;
  models: OllamaModelInfo[];
  canAutoStart?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', baseUrl }),
    });

    const data = await res.json();
    return {
      isRunning: Boolean(data.isRunning),
      version: data.version,
      models: Array.isArray(data.models) ? data.models : [],
      canAutoStart: Boolean(data.canAutoStart),
      error: data.error,
    };
  } catch (err: any) {
    return {
      isRunning: false,
      models: [],
      error: err?.message || 'Connection test failed',
    };
  }
}

/**
 * Attempts to launch local Ollama daemon if installed on Windows
 */
export async function startOllamaServer(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start-server' }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to start Ollama server' };
  }
}

/**
 * Pulls/installs a model with progress callback
 */
export async function pullOllamaModel(
  modelName: string,
  onProgress?: (status: string, percent?: number) => void,
  baseUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pull', modelName, baseUrl }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || `HTTP ${res.status}` };
    }

    if (!res.body) {
      return { success: true };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const status = data.status || 'Downloading...';
          let percent: number | undefined = undefined;
          if (data.total && data.completed) {
            percent = Math.round((data.completed / data.total) * 100);
          }
          if (onProgress) onProgress(status, percent);
        } catch {
          // Non-json progress line
          if (onProgress) onProgress(line);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed pulling model' };
  }
}

/**
 * Deletes an installed model
 */
export async function deleteOllamaModel(
  modelName: string,
  baseUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', modelName, baseUrl }),
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed deleting model' };
  }
}

/**
 * Streams chat responses from Ollama
 */
export async function streamOllamaChat(
  model: string,
  messages: Array<{ role: string; content: string; images?: string[] }>,
  onChunk: (chunk: string) => void,
  options?: {
    system?: string;
    temperature?: number;
    baseUrl?: string;
    signal?: AbortSignal;
  }
): Promise<string> {
  const res = await fetch('/api/ollama', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'chat',
      model,
      messages,
      system: options?.system,
      temperature: options?.temperature,
      baseUrl: options?.baseUrl,
      stream: true,
    }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Ollama returned HTTP ${res.status}`);
  }

  if (!res.body) {
    throw new Error('Response body stream not available');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const chunk = json.message?.content || json.response || '';
        if (chunk) {
          fullText += chunk;
          onChunk(chunk);
        }
      } catch {
        // Plain text fallback
        fullText += line;
        onChunk(line);
      }
    }
  }

  return fullText;
}

/**
 * Builds a structured prompt for summarizing a note
 */
export function buildNoteSummaryPrompt(
  note: Partial<Note>,
  style: 'bullet' | 'concise' | 'action_items' | 'comprehensive' | 'translate' = 'bullet'
): { system: string; user: string } {
  const title = note.title || 'Untitled Note';
  const category = note.category ? `Category: ${note.category}\n` : '';
  const labels = note.labels && note.labels.length > 0 ? `Labels: ${note.labels.join(', ')}\n` : '';
  const content = (note.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const system =
    'You are an intelligent, concise AI note assistant embedded in Google Keep Clone. Provide clear, direct, and well-structured markdown answers without meta commentary.';

  let instruction = '';
  switch (style) {
    case 'bullet':
      instruction = 'Provide a structured bullet-point summary highlighting the key points, topics, and important notes.';
      break;
    case 'concise':
      instruction = 'Provide a brief, 2-3 sentence executive summary capturing the core essence of this note.';
      break;
    case 'action_items':
      instruction = 'Extract all action items, tasks, follow-ups, and to-dos as a markdown checklist (`- [ ] task`). If none are explicit, infer logical next steps.';
      break;
    case 'comprehensive':
      instruction = 'Provide a detailed, comprehensive synthesis organized by headings, key points, context, and takeaways.';
      break;
    case 'translate':
      instruction = 'Translate this note clearly and accurately into English (or preserve existing language if already English, offering a polished refinement).';
      break;
  }

  const user = `Here is the note to analyze:\n\n**Title:** ${title}\n${category}${labels}**Content:**\n${content}\n\n**Task:** ${instruction}`;

  return { system, user };
}
