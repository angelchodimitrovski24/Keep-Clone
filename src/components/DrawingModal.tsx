'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Check,
  X,
  Palette,
} from 'lucide-react';
import { NoteDrawing } from '@/types/note';

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDrawing: (drawing: NoteDrawing) => void;
  existingDrawing?: NoteDrawing | null;
}

export const DrawingModal: React.FC<DrawingModalProps> = ({
  isOpen,
  onClose,
  onSaveDrawing,
  existingDrawing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#202124');
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Default white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (existingDrawing?.dataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        saveState();
      };
      img.src = existingDrawing.dataUrl;
    } else {
      saveState();
    }
  }, [isOpen, existingDrawing]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(0, historyStep + 1), data]);
    setHistoryStep((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (historyStep <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextStep = historyStep - 1;
    setHistoryStep(nextStep);
    ctx.putImageData(history[nextStep], 0, 0);
  };

  const handleRedo = () => {
    if (historyStep >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextStep = historyStep + 1;
    setHistoryStep(nextStep);
    ctx.putImageData(history[nextStep], 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    saveState();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveDrawing({
      id: 'draw-' + Date.now(),
      dataUrl,
      createdAt: Date.now(),
    });
    onClose();
  };

  if (!isOpen) return null;

  const colors = [
    '#202124',
    '#ea4335',
    '#fbbc04',
    '#34a853',
    '#4285f4',
    '#9c27b0',
    '#e91e63',
    '#00bcd4',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#202124] w-full h-full sm:h-[85vh] sm:max-w-4xl rounded-none sm:rounded-2xl shadow-none sm:shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-stone-200 dark:border-stone-700">
        {/* Drawing Toolbar */}
        <div className="p-2 sm:p-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar bg-stone-50 dark:bg-[#2a2b2d] shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium ${
                tool === 'pen'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <PenTool className="w-4 h-4" />
              Pen
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium ${
                tool === 'eraser'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              <Eraser className="w-4 h-4" />
              Eraser
            </button>

            {/* Stroke size */}
            <div className="flex items-center gap-1.5 ml-2 border-l border-stone-300 dark:border-stone-600 pl-3">
              {[2, 5, 10, 18].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setLineWidth(size)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700 ${
                    lineWidth === size ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div
                    className="bg-stone-800 dark:bg-stone-200 rounded-full"
                    style={{ width: size, height: size }}
                  />
                </button>
              ))}
            </div>

            {/* Color Palette */}
            {tool === 'pen' && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-stone-300 dark:border-stone-600 pl-3">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                      color === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-red-500"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors ml-2"
            >
              <Check className="w-4 h-4" />
              Save to Note
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-white relative cursor-crosshair overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
};
