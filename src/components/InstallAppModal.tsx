'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Download,
  CheckCircle2,
  Sparkles,
  Shield,
  WifiOff,
  Maximize2,
  Layers,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useKeep } from '@/context/KeepContext';

type PlatformTab = 'android-chrome' | 'samsung-internet' | 'firefox-android' | 'ios-safari';

export const InstallAppModal: React.FC = () => {
  const {
    isInstallModalOpen,
    setIsInstallModalOpen,
    canInstallPwa,
    isPwaInstalled,
    promptInstallPwa,
  } = useKeep();

  const [activeTab, setActiveTab] = useState<PlatformTab>('android-chrome');
  const [isInstalling, setIsInstalling] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string>('Android');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) {
      if (/samsungbrowser/i.test(ua)) {
        setActiveTab('samsung-internet');
        setDetectedPlatform('Samsung Internet on Android');
      } else if (/firefox/i.test(ua)) {
        setActiveTab('firefox-android');
        setDetectedPlatform('Firefox on Android');
      } else {
        setActiveTab('android-chrome');
        setDetectedPlatform('Chrome on Android');
      }
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      setActiveTab('ios-safari');
      setDetectedPlatform('iOS Safari');
    } else {
      setActiveTab('android-chrome');
      setDetectedPlatform('Android / Chromium Browser');
    }
  }, [isInstallModalOpen]);

  if (!isInstallModalOpen) return null;

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await promptInstallPwa();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div
      onClick={() => setIsInstallModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-[#202124] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700 flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-stone-200 dark:border-stone-800 bg-linear-to-b from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* App Icon */}
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md ring-2 ring-amber-500/30 shrink-0 bg-amber-500 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon-192.png"
                  alt="Google Keep Icon"
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100 tracking-tight">
                    Install on Android
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    PWA App
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                  Full standalone app with 100% offline note-taking and zero browser clutter.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsInstallModalOpen(false)}
              className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 flex-1">
          {/* Status banner */}
          {isPwaInstalled ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-xs">
                <span className="font-semibold block">Keep is already installed!</span>
                You are currently running the installed standalone version from your device.
              </div>
            </div>
          ) : canInstallPwa ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-xs">
                  <span className="font-bold text-sm block">1-Tap Direct Install Ready!</span>
                  Your browser supports instant installation right now.
                </div>
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>{isInstalling ? 'Installing…' : 'Install App Now'}</span>
              </button>
            </div>
          ) : null}

          {/* Quick Features Highlight */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                  100% Offline
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight block mt-0.5">
                  Works without internet via local IndexedDB.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                <Maximize2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                  Full Screen App
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight block mt-0.5">
                  Zero URL bar distractions or browser tabs.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                  Home Screen Icon
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight block mt-0.5">
                  Launches like a native Android APK app.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60 flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                  AES-256 Protected
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight block mt-0.5">
                  Hardware-accelerated note encryption.
                </span>
              </div>
            </div>
          </div>

          {/* Browser Specific Installation Instructions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                How to Install Directly from Browser
              </label>
              <span className="text-[11px] text-stone-500">
                Detected: <strong className="text-amber-600 dark:text-amber-400">{detectedPlatform}</strong>
              </span>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl mb-3 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('android-chrome')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors text-center ${
                  activeTab === 'android-chrome'
                    ? 'bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Chrome / Brave
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('samsung-internet')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors text-center ${
                  activeTab === 'samsung-internet'
                    ? 'bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Samsung Internet
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('firefox-android')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors text-center ${
                  activeTab === 'firefox-android'
                    ? 'bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                Firefox Android
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios-safari')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors text-center ${
                  activeTab === 'ios-safari'
                    ? 'bg-white dark:bg-[#202124] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                iOS Safari
              </button>
            </div>

            {/* Tab content: Android Chrome / Brave / Edge */}
            {activeTab === 'android-chrome' && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Tap the 3 dots menu
                    </span>
                    In Google Chrome or Brave, tap the <strong className="font-mono text-stone-900 dark:text-stone-100">⋮ (three dots)</strong> in the top-right corner.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Select &quot;Install app&quot; or &quot;Add to Home screen&quot;
                    </span>
                    Look down the menu list and tap <strong className="text-amber-700 dark:text-amber-400">&quot;Install app&quot;</strong> or <strong className="text-amber-700 dark:text-amber-400">&quot;Add to Home screen&quot;</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Confirm &quot;Install&quot;
                    </span>
                    Tap <strong className="text-amber-700 dark:text-amber-400">&quot;Install&quot;</strong> in the confirmation popup. Android will automatically add the Google Keep icon to your home screen and app drawer!
                  </div>
                </div>
              </div>
            )}

            {/* Tab content: Samsung Internet */}
            {activeTab === 'samsung-internet' && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Tap the menu button
                    </span>
                    Tap the <strong className="font-mono text-stone-900 dark:text-stone-100">☰ (three horizontal lines)</strong> in the bottom-right corner of Samsung Internet.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Tap &quot;+ Add page to&quot;
                    </span>
                    Select <strong className="text-amber-700 dark:text-amber-400">&quot;+ Add page to&quot;</strong> from the popup menu.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Choose &quot;Home screen&quot; or &quot;App screen&quot;
                    </span>
                    Tap <strong className="text-amber-700 dark:text-amber-400">&quot;Home screen&quot;</strong>, then confirm <strong className="text-amber-700 dark:text-amber-400">&quot;Add&quot;</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Tab content: Firefox Android */}
            {activeTab === 'firefox-android' && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Tap the Firefox menu
                    </span>
                    Tap the <strong className="font-mono text-stone-900 dark:text-stone-100">⋮ (three dots)</strong> menu icon beside the URL address bar.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Select &quot;Install&quot;
                    </span>
                    Tap <strong className="text-amber-700 dark:text-amber-400">&quot;Install&quot;</strong> or &quot;Add to Home screen&quot; to place the app on your Android device.
                  </div>
                </div>
              </div>
            )}

            {/* Tab content: iOS Safari */}
            {activeTab === 'ios-safari' && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Tap the Share Button
                    </span>
                    In Safari, tap the <strong className="text-stone-900 dark:text-stone-100">Share icon</strong> (square with an arrow pointing upward) in the bottom toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Select &quot;Add to Home Screen&quot;
                    </span>
                    Scroll down through the share sheet options and tap <strong className="text-amber-700 dark:text-amber-400">&quot;Add to Home Screen&quot;</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                      Tap &quot;Add&quot;
                    </span>
                    Tap <strong className="text-amber-700 dark:text-amber-400">&quot;Add&quot;</strong> in the top-right corner to finish.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
            <Info className="w-3.5 h-3.5" />
            <span>Works 100% offline via local storage</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInstallModalOpen(false)}
              className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 font-medium text-xs transition-colors"
            >
              Close
            </button>
            {canInstallPwa && !isPwaInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstalling ? 'Installing…' : 'Install on Android'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
