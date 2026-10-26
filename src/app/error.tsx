'use client';

import React, { useEffect } from 'react';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#18191a] text-stone-900 dark:text-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#202124] rounded-2xl p-6 sm:p-8 shadow-xl border border-black/10 dark:border-stone-700/60 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1.5">
            {error?.message || 'An unexpected error occurred while loading this view.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-medium rounded-xl flex items-center gap-2 transition-colors text-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try again</span>
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 font-medium rounded-xl flex items-center gap-2 transition-colors text-sm"
          >
            <Home className="w-4 h-4" />
            <span>Go to Notes</span>
          </a>
        </div>
      </div>
    </div>
  );
}
