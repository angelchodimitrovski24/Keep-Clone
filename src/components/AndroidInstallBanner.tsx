'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Sparkles } from 'lucide-react';
import { useKeep } from '@/context/KeepContext';

export const AndroidInstallBanner: React.FC = () => {
  const { isPwaInstalled, canInstallPwa, promptInstallPwa, setIsInstallModalOpen } = useKeep();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Do not show if already running installed standalone PWA
    if (isPwaInstalled) {
      setIsVisible(false);
      return;
    }

    // Check if dismissed recently (within 7 days)
    const dismissedUntil = localStorage.getItem('keep_install_banner_dismissed_until');
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setIsVisible(false);
      return;
    }

    // Detect mobile or Android
    const ua = navigator.userAgent || '';
    const isMobileOrAndroid = /android|iphone|ipad|ipod|mobile/i.test(ua) || window.innerWidth < 768;

    if (isMobileOrAndroid) {
      // Show banner smoothly after 2 seconds of usage
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isPwaInstalled]);

  const handleDismiss = () => {
    setIsVisible(false);
    // Dismiss for 7 days
    if (typeof window !== 'undefined') {
      const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('keep_install_banner_dismissed_until', String(sevenDays));
    }
  };

  const handleInstall = async () => {
    if (canInstallPwa) {
      await promptInstallPwa();
    } else {
      setIsInstallModalOpen(true);
    }
  };

  if (!isVisible || isPwaInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-45 animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-white dark:bg-[#202124] p-3.5 sm:p-4 rounded-2xl shadow-xl border border-amber-500/30 flex items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-amber-500 shadow-xs shrink-0 flex items-center justify-center ring-1 ring-amber-500/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="Keep" className="w-full h-full object-cover" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                Install on Android
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                Offline
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
              Add to Home screen for full-screen offline notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-bold text-xs shadow-xs flex items-center gap-1 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
