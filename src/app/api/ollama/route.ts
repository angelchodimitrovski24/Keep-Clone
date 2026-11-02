import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

function normalizeOllamaBaseUrl(url?: string): string {
  let clean = (url || 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  return clean;
}

function findOllamaExecutable(): string | null {
  const possiblePaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Users\\Angelcho\\AppData\\Local\\Programs\\Ollama\\ollama.exe',
    'C:\\Program Files\\Ollama\\ollama.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      return p;
    }
  }

  // Fallback to searching on PATH
  return 'ollama.exe';
}

export async function GET(req: NextRequest) {
  const targetBase = normalizeOllamaBaseUrl(req.nextUrl.searchParams.get('baseUrl') || undefined);
  try {
    const [vRes, tRes] = await Promise.all([
      fetch(`${targetBase}/api/version`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${targetBase}/api/tags`, { signal: AbortSignal.timeout(3000) }),
    ]);

    if (vRes.ok) {
      const vData = await vRes.json().catch(() => ({}));
      const tData = await tRes.json().catch(() => ({ models: [] }));
      return NextResponse.json({
        isRunning: true,
        version: vData.version || 'unknown',
        models: tData.models || [],
      });
    }
  } catch {
    // Offline
  }

  const exePath = findOllamaExecutable();
  return NextResponse.json({
    isRunning: false,
    version: null,
    models: [],
    canAutoStart: Boolean(exePath),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, baseUrl, modelName, model, messages, stream, temperature, system } = body;
    const targetBase = normalizeOllamaBaseUrl(baseUrl);

    // 1. Status Check
    if (action === 'status') {
      try {
        const [vRes, tRes] = await Promise.all([
          fetch(`${targetBase}/api/version`, { signal: AbortSignal.timeout(3000) }),
          fetch(`${targetBase}/api/tags`, { signal: AbortSignal.timeout(3000) }),
        ]);

        if (vRes.ok) {
          const vData = await vRes.json().catch(() => ({}));
          const tData = await tRes.json().catch(() => ({ models: [] }));
          return NextResponse.json({
            isRunning: true,
            version: vData.version || '0.1.0',
            models: tData.models || [],
          });
        }
      } catch {
        // Not reachable
      }

      const exe = findOllamaExecutable();
      return NextResponse.json({
        isRunning: false,
        models: [],
        canAutoStart: Boolean(exe),
        error: `Ollama is not running at ${targetBase}. Click 'Start Ollama' or start it from terminal.`,
      });
    }

    // 2. Start Local Ollama Server
    if (action === 'start-server') {
      const exe = findOllamaExecutable();
      if (!exe) {
        return NextResponse.json(
          { success: false, message: 'Ollama executable not found. Please install Ollama from https://ollama.com' },
          { status: 404 }
        );
      }

      try {
        const child = spawn(/*turbopackIgnore: true*/ exe, ['serve'], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        // Wait up to 5 seconds for Ollama to become healthy
        for (let i = 0; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 500));
          try {
            const check = await fetch(`${targetBase}/api/version`, { signal: AbortSignal.timeout(1000) });
            if (check.ok) {
              const vData = await check.json().catch(() => ({}));
              return NextResponse.json({
                success: true,
                message: `Ollama started successfully (version ${vData.version || 'ready'})!`,
                version: vData.version,
              });
            }
          } catch {
            // keep waiting
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Ollama start signal dispatched. Checking connectivity...',
        });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, message: `Failed to spawn Ollama process: ${err?.message}` },
          { status: 500 }
        );
      }
    }

    // 3. List Models
    if (action === 'models') {
      try {
        const res = await fetch(`${targetBase}/api/tags`);
        if (!res.ok) {
          return NextResponse.json({ models: [], error: `Ollama returned HTTP ${res.status}` }, { status: res.status });
        }
        const data = await res.json();
        return NextResponse.json({ models: data.models || [] });
      } catch (err: any) {
        return NextResponse.json({ models: [], error: err?.message || 'Failed connecting to Ollama' }, { status: 500 });
      }
    }

    // 4. Pull / Install Model (Streaming Proxy)
    if (action === 'pull') {
      if (!modelName) {
        return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
      }

      try {
        const upstreamRes = await fetch(`${targetBase}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName, stream: true }),
        });

        if (!upstreamRes.ok || !upstreamRes.body) {
          const errText = await upstreamRes.text().catch(() => '');
          return NextResponse.json(
            { error: `Ollama pull failed: ${errText || `HTTP ${upstreamRes.status}`}` },
            { status: upstreamRes.status }
          );
        }

        // Stream back to client
        return new Response(upstreamRes.body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache, no-transform',
          },
        });
      } catch (err: any) {
        return NextResponse.json({ error: `Connection error: ${err?.message}` }, { status: 500 });
      }
    }

    // 5. Delete Model
    if (action === 'delete') {
      if (!modelName) {
        return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
      }

      try {
        const res = await fetch(`${targetBase}/api/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName }),
        });

        if (res.ok) {
          return NextResponse.json({ success: true, message: `Model ${modelName} deleted` });
        } else {
          const txt = await res.text();
          return NextResponse.json({ success: false, error: txt || `HTTP ${res.status}` }, { status: res.status });
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
      }
    }

    // 6. Chat (Streaming or Non-streaming)
    if (action === 'chat') {
      if (!model) {
        return NextResponse.json({ error: 'Model is required' }, { status: 400 });
      }
      if (!messages || !Array.isArray(messages)) {
        return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
      }

      const formattedMessages = [...messages];
      if (system && !formattedMessages.some((m) => m.role === 'system')) {
        formattedMessages.unshift({ role: 'system', content: system });
      }

      const payload: any = {
        model,
        messages: formattedMessages,
        stream: Boolean(stream),
        options: {
          temperature: typeof temperature === 'number' ? temperature : 0.7,
          ...(body.numPredict ? { num_predict: body.numPredict } : {}),
          ...(body.options && typeof body.options === 'object' ? body.options : {}),
        },
      };

      try {
        const upstreamRes = await fetch(`${targetBase}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!upstreamRes.ok || !upstreamRes.body) {
          const errText = await upstreamRes.text().catch(() => '');
          return NextResponse.json(
            { error: `Ollama chat error: ${errText || `HTTP ${upstreamRes.status}`}` },
            { status: upstreamRes.status }
          );
        }

        if (stream) {
          // Stream directly to browser
          return new Response(upstreamRes.body, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Transfer-Encoding': 'chunked',
              'Cache-Control': 'no-cache, no-transform',
            },
          });
        } else {
          const data = await upstreamRes.json();
          return NextResponse.json(data);
        }
      } catch (err: any) {
        return NextResponse.json(
          { error: `Error communicating with Ollama: ${err?.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
