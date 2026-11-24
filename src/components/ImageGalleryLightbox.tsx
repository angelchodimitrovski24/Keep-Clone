'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';
import { GalleryImageItem } from '@/lib/imageGalleryUtils';
import { resolveLocalMediaUrl } from '@/lib/formatUtils';

export interface ImageGalleryLightboxProps {
  images: GalleryImageItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onDeleteIndex?: (index: number) => void;
}

function getDisplaySrc(item: GalleryImageItem | undefined, useTitleFallback: boolean): string {
  if (!item) return '';
  if (useTitleFallback && item.title) {
    return resolveLocalMediaUrl(item.title);
  }
  return resolveLocalMediaUrl(item.src || item.title || '');
}

const ImageGalleryLightboxInner: React.FC<Omit<ImageGalleryLightboxProps, 'isOpen'>> = ({
  images,
  initialIndex,
  onClose,
  onDeleteIndex,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, Math.max(0, images.length - 1)))
  );
  const [failedTitleFallbackKeys, setFailedTitleFallbackKeys] = useState<Record<string, boolean>>({});
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const safeIndex = images.length > 0 ? Math.max(0, Math.min(currentIndex, images.length - 1)) : 0;
  const activeItem = images[safeIndex];

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, goPrev, goNext]);

  // Prevent background page scrolling while lightbox is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Keep active thumbnail centered in the horizontal strip
  useEffect(() => {
    const activeThumb = thumbRefs.current[safeIndex];
    if (activeThumb) {
      activeThumb.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [safeIndex]);

  if (images.length === 0 || typeof document === 'undefined') {
    return null;
  }

  const activeKey = `${safeIndex}-${activeItem?.src || ''}`;
  const mainSrc = getDisplaySrc(activeItem, Boolean(failedTitleFallbackKeys[activeKey]));
  const displayName = activeItem?.alt || `Image ${safeIndex + 1}`;

  const content = (
    <div
      data-keep-gallery-ui="true"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery viewer"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (touch) {
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start || images.length <= 1) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx > 0) goPrev();
          else goNext();
        }
      }}
      className="fixed inset-0 z-[220] bg-black/92 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-150"
    >
      {/* Top Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 pt-[max(0.65rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/75 to-transparent text-white shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold tabular-nums shrink-0">
            {safeIndex + 1} / {images.length}
          </span>
          <span className="text-xs sm:text-sm text-white/80 truncate">
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {mainSrc && (
            <a
              href={mainSrc}
              download={displayName}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
          )}

          {onDeleteIndex && (
            <button
              type="button"
              onClick={() => {
                const idxToDelete = safeIndex;
                onDeleteIndex(idxToDelete);
                if (images.length <= 1) {
                  onClose();
                } else if (idxToDelete >= images.length - 1) {
                  setCurrentIndex(Math.max(0, images.length - 2));
                }
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 active:bg-red-600 text-white transition-colors cursor-pointer"
              title="Remove image"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 text-white transition-colors cursor-pointer"
            title="Close viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center px-2 sm:px-14 py-2 overflow-hidden">
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 rounded-full bg-black/45 hover:bg-black/70 active:bg-black/80 text-white border border-white/15 backdrop-blur-xs transition-all cursor-pointer"
            title="Previous image (←)"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mainSrc}
          alt={displayName}
          onClick={(e) => e.stopPropagation()}
          onError={() => {
            if (activeItem?.title && !failedTitleFallbackKeys[activeKey]) {
              setFailedTitleFallbackKeys((prev) => ({ ...prev, [activeKey]: true }));
            }
          }}
          className="max-w-full max-h-full object-contain rounded-lg sm:rounded-2xl shadow-2xl"
        />

        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full bg-black/45 hover:bg-black/70 active:bg-black/80 text-white border border-white/15 backdrop-blur-xs transition-all cursor-pointer"
            title="Next image (→)"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 bg-gradient-to-t from-black/85 to-transparent px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-x-auto no-scrollbar"
        >
          <div className="w-max mx-auto flex items-center gap-1.5 sm:gap-2">
            {images.map((img, idx) => {
              const thumbKey = `thumb-${idx}-${img.src}`;
              const thumbSrc = getDisplaySrc(img, Boolean(failedTitleFallbackKeys[thumbKey]));
              const isActive = idx === safeIndex;
              return (
                <button
                  key={`${idx}-${img.src}`}
                  ref={(el) => {
                    thumbRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0 transition-all cursor-pointer border ${
                    isActive
                      ? 'ring-2 ring-amber-400 border-amber-400 opacity-100 scale-105'
                      : 'border-white/15 opacity-55 hover:opacity-90'
                  }`}
                  title={img.alt || `Image ${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbSrc}
                    alt={img.alt || `Thumbnail ${idx + 1}`}
                    onError={() => {
                      if (img.title && !failedTitleFallbackKeys[thumbKey]) {
                        setFailedTitleFallbackKeys((prev) => ({ ...prev, [thumbKey]: true }));
                      }
                    }}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export const ImageGalleryLightbox: React.FC<ImageGalleryLightboxProps> = ({
  isOpen,
  initialIndex,
  images,
  ...rest
}) => {
  if (!isOpen || images.length === 0) return null;
  return (
    <ImageGalleryLightboxInner
      key={`lb-${initialIndex}`}
      images={images}
      initialIndex={initialIndex}
      {...rest}
    />
  );
};
