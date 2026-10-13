'use client';

import React from 'react';
import { NoteBackgroundTheme } from '@/types/note';

interface NoteThemeArtworkProps {
  theme?: NoteBackgroundTheme;
  isModal?: boolean;
}

export const NoteThemeArtwork: React.FC<NoteThemeArtworkProps> = ({
  theme = 'none',
  isModal = false,
}) => {
  if (!theme || theme === 'none') return null;

  const sizeClasses = isModal
    ? 'w-48 h-32 sm:w-64 sm:h-40 right-2 bottom-12'
    : 'w-28 h-20 sm:w-36 sm:h-24 right-1 bottom-8';

  return (
    <div
      aria-hidden="true"
      className={`absolute select-none pointer-events-none overflow-hidden transition-opacity duration-300 opacity-25 dark:opacity-20 ${sizeClasses}`}
    >
      {theme === 'groceries' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-amber-700/60 dark:fill-amber-400/50">
          {/* Grocery Bag */}
          <path d="M40 45 L120 45 L110 115 L50 115 Z" fill="currentColor" opacity="0.4" />
          <path d="M48 45 L55 20 L65 20 L60 45" stroke="currentColor" strokeWidth="4" fill="none" />
          {/* Baguette */}
          <path d="M70 50 L95 10 A8 8 0 0 1 108 18 L85 55 Z" fill="#d97706" opacity="0.8" />
          <line x1="80" y1="35" x2="88" y2="30" stroke="#fff" strokeWidth="2" opacity="0.6" />
          <line x1="87" y1="26" x2="95" y2="21" stroke="#fff" strokeWidth="2" opacity="0.6" />
          {/* Apple & Orange */}
          <circle cx="50" cy="40" r="14" fill="#ef4444" opacity="0.75" />
          <circle cx="68" cy="42" r="11" fill="#f97316" opacity="0.75" />
          {/* Milk / Bottle */}
          <rect x="100" y="25" width="18" height="35" rx="3" fill="#38bdf8" opacity="0.7" />
          <rect x="105" y="18" width="8" height="7" rx="1" fill="#0284c7" opacity="0.8" />
        </svg>
      )}

      {theme === 'food' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-rose-700/60 dark:fill-rose-400/50">
          {/* Burger */}
          <path d="M45 75 Q80 40 115 75 Z" fill="#f59e0b" opacity="0.8" />
          <rect x="40" y="78" width="80" height="7" rx="3" fill="#10b981" opacity="0.8" />
          <rect x="42" y="87" width="76" height="8" rx="4" fill="#b91c1c" opacity="0.85" />
          <rect x="40" y="97" width="80" height="10" rx="5" fill="#f59e0b" opacity="0.8" />
          {/* Seeds on bun */}
          <ellipse cx="65" cy="62" rx="2" ry="1" fill="#fff" opacity="0.8" />
          <ellipse cx="80" cy="55" rx="2" ry="1" fill="#fff" opacity="0.8" />
          <ellipse cx="95" cy="63" rx="2" ry="1" fill="#fff" opacity="0.8" />
          {/* Drink Cup */}
          <path d="M120 50 L145 50 L140 105 L125 105 Z" fill="#ef4444" opacity="0.6" />
          <line x1="132" y1="20" x2="135" y2="50" stroke="#f59e0b" strokeWidth="4" />
        </svg>
      )}

      {theme === 'music' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-purple-700/60 dark:fill-purple-400/50">
          {/* Headphones */}
          <path
            d="M35 70 A45 45 0 0 1 125 70"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.75"
          />
          <rect x="25" y="65" width="16" height="32" rx="8" fill="currentColor" opacity="0.9" />
          <rect x="119" y="65" width="16" height="32" rx="8" fill="currentColor" opacity="0.9" />
          {/* Vinyl Record */}
          <circle cx="80" cy="75" r="30" fill="currentColor" opacity="0.35" />
          <circle cx="80" cy="75" r="22" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
          <circle cx="80" cy="75" r="14" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.5" />
          <circle cx="80" cy="75" r="7" fill="#8b5cf6" opacity="0.9" />
          {/* Musical Notes */}
          <path d="M135 30 L150 24 L150 42 A5 4 0 1 1 144 38 L144 28" fill="#8b5cf6" opacity="0.8" />
          <path d="M25 45 L36 40 L36 54 A4 3 0 1 1 31 51 L31 43" fill="#8b5cf6" opacity="0.8" />
        </svg>
      )}

      {theme === 'recipes' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-lime-700/60 dark:fill-lime-400/50">
          {/* Chef Hat */}
          <path
            d="M55 60 C40 55 45 35 60 35 C65 20 90 20 95 35 C110 35 115 55 100 60 Z"
            fill="currentColor"
            opacity="0.45"
          />
          <rect x="55" y="60" width="45" height="12" rx="2" fill="currentColor" opacity="0.6" />
          {/* Rolling Pin */}
          <path
            d="M30 100 L130 50"
            stroke="#d97706"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path d="M22 104 L32 99" stroke="#92400e" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
          <path d="M128 51 L138 46" stroke="#92400e" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
          {/* Whisk / Bowl */}
          <path d="M85 80 Q115 80 125 110 L75 110 Z" fill="#65a30d" opacity="0.5" />
        </svg>
      )}

      {theme === 'notes' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-sky-700/60 dark:fill-sky-400/50">
          {/* Notebook */}
          <rect x="50" y="30" width="65" height="85" rx="5" fill="currentColor" opacity="0.35" />
          <rect x="45" y="30" width="10" height="85" rx="3" fill="#0284c7" opacity="0.7" />
          <line x1="62" y1="48" x2="105" y2="48" stroke="currentColor" strokeWidth="3" opacity="0.6" />
          <line x1="62" y1="62" x2="105" y2="62" stroke="currentColor" strokeWidth="3" opacity="0.6" />
          <line x1="62" y1="76" x2="95" y2="76" stroke="currentColor" strokeWidth="3" opacity="0.6" />
          {/* Pencil */}
          <g transform="translate(110, 20) rotate(35)">
            <rect x="0" y="0" width="12" height="60" fill="#f59e0b" opacity="0.9" />
            <polygon points="0,60 12,60 6,75" fill="#fde68a" />
            <polygon points="4,70 8,70 6,75" fill="#1e293b" />
            <rect x="0" y="-8" width="12" height="8" rx="2" fill="#ec4899" />
          </g>
        </svg>
      )}

      {theme === 'places' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-teal-700/60 dark:fill-teal-400/50">
          {/* Cityscape Buildings */}
          <rect x="35" y="55" width="22" height="65" fill="currentColor" opacity="0.3" />
          <rect x="60" y="35" width="28" height="85" fill="currentColor" opacity="0.45" />
          <rect x="91" y="60" width="20" height="60" fill="currentColor" opacity="0.35" />
          <rect x="114" y="45" width="25" height="75" fill="currentColor" opacity="0.4" />
          {/* Map Pin */}
          <g transform="translate(68, 12)">
            <path
              d="M12 0 C5.37 0 0 5.37 0 12 C0 21 12 32 12 32 C12 32 24 21 24 12 C24 5.37 18.63 0 12 0 Z"
              fill="#ef4444"
              opacity="0.85"
            />
            <circle cx="12" cy="11" r="5" fill="#fff" />
          </g>
        </svg>
      )}

      {theme === 'travel' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-cyan-700/60 dark:fill-cyan-400/50">
          {/* Suitcase */}
          <rect x="55" y="55" width="70" height="55" rx="8" fill="#0284c7" opacity="0.5" />
          <rect x="75" y="42" width="30" height="15" rx="3" stroke="#0284c7" strokeWidth="4" fill="none" opacity="0.8" />
          <line x1="72" y1="55" x2="72" y2="110" stroke="#fff" strokeWidth="3" opacity="0.6" />
          <line x1="108" y1="55" x2="108" y2="110" stroke="#fff" strokeWidth="3" opacity="0.6" />
          {/* Airplane */}
          <g transform="translate(100, 15) rotate(-20)">
            <path
              d="M0 12 L28 12 L35 0 L40 0 L36 12 L50 12 L54 6 L58 6 L56 15 L58 24 L54 24 L50 18 L36 18 L40 30 L35 30 L28 18 L0 18 Z"
              fill="#06b6d4"
              opacity="0.8"
            />
          </g>
          {/* Cloud */}
          <ellipse cx="40" cy="35" rx="18" ry="10" fill="currentColor" opacity="0.25" />
          <ellipse cx="52" cy="30" rx="14" ry="12" fill="currentColor" opacity="0.3" />
        </svg>
      )}

      {theme === 'celebration' && (
        <svg viewBox="0 0 160 120" className="w-full h-full fill-pink-700/60 dark:fill-pink-400/50">
          {/* Balloons */}
          <ellipse cx="50" cy="45" rx="18" ry="24" fill="#ec4899" opacity="0.75" />
          <path d="M50 69 L48 73 L52 73 Z" fill="#ec4899" />
          <path d="M50 73 Q55 90 48 105" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />

          <ellipse cx="78" cy="35" rx="16" ry="22" fill="#8b5cf6" opacity="0.75" />
          <path d="M78 57 L76 61 L80 61 Z" fill="#8b5cf6" />
          <path d="M78 61 Q70 80 82 105" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />

          {/* Party Hat */}
          <polygon points="105,95 130,45 145,95" fill="#f59e0b" opacity="0.7" />
          <circle cx="130" cy="42" r="5" fill="#ef4444" opacity="0.85" />

          {/* Confetti */}
          <rect x="90" y="25" width="4" height="8" rx="1" fill="#10b981" transform="rotate(25 90 25)" opacity="0.8" />
          <rect x="135" y="20" width="5" height="5" rx="1" fill="#3b82f6" transform="rotate(45 135 20)" opacity="0.8" />
          <rect x="30" y="65" width="4" height="8" rx="1" fill="#f59e0b" transform="rotate(-30 30 65)" opacity="0.8" />
          <circle cx="110" cy="20" r="3" fill="#ec4899" opacity="0.8" />
        </svg>
      )}
    </div>
  );
};
