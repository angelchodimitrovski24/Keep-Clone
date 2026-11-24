'use client';

import React, { useRef, useState } from 'react';
import {
  Images,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Rows3,
} from 'lucide-react';
import { GalleryImageItem } from '@/lib/imageGalleryUtils';
import { resolveLocalMediaUrl } from '@/lib/formatUtils';
import { ImageGalleryLightbox } from './ImageGalleryLightbox';

export interface ImageGalleryGridProps {
  images: GalleryImageItem[];
  variant?: 'card' | 'editor' | 'full';
  maxVisible?: number;
  interactive?: boolean;
  editable?: boolean;
  onImageClick?: (index: number, e: React.MouseEvent) => void;
  onRemoveImage?: (index: number) => void;
  onMoveImage?: (fromIndex: number, toIndex: number) => void;
  onAddImages?: (files: File[]) => void;
  onUngroup?: () => void;
  headerLabel?: string;
  className?: string;
}

function getGridColumnsClass(displayCount: number, variant: 'card' | 'editor' | 'full'): string {
  if (displayCount <= 1) return 'grid-cols-1';
  if (displayCount === 2) return 'grid-cols-2';
  if (displayCount === 3) return 'grid-cols-3';
  if (displayCount === 4) {
    return variant === 'card' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4';
  }
  return variant === 'card' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4';
}

function getTileClasses(displayCount: number, variant: 'card' | 'editor' | 'full'): string {
  if (displayCount === 1) {
    if (variant === 'card') {
      return 'max-h-52 w-full bg-black/[0.03] dark:bg-white/[0.03]';
    }
    return 'max-h-72 sm:max-h-96 w-full bg-black/[0.03] dark:bg-white/[0.03]';
  }

  if (variant === 'card') {
    if (displayCount === 2) return 'aspect-[4/3] max-h-36';
    if (displayCount === 3) return 'aspect-square max-h-28';
    return 'aspect-[4/3] max-h-28';
  }

  if (displayCount === 2) return 'aspect-[4/3] sm:aspect-[16/11]';
  if (displayCount === 3) return 'aspect-square sm:aspect-[4/3]';
  if (displayCount === 4) return 'aspect-square sm:aspect-[4/3]';
  return 'aspect-square';
}

export const ImageGalleryGrid: React.FC<ImageGalleryGridProps> = ({
  images,
  variant = 'full',
  maxVisible,
  interactive = variant !== 'card' || images.length >= 2,
  editable = false,
  onImageClick,
  onRemoveImage,
  onMoveImage,
  onAddImages,
  onUngroup,
  headerLabel,
  className = '',
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [fallbackTitleKeys, setFallbackTitleKeys] = useState<Record<string, boolean>>({});
  const addInputRef = useRef<HTMLInputElement>(null);

  if (!images || images.length === 0) return null;

  const limit = maxVisible && maxVisible > 0 ? maxVisible : images.length;
  const displayedImages = images.slice(0, limit);
  const hiddenCount = Math.max(0, images.length - displayedImages.length);
  const displayCount = displayedImages.length;

  const gridColsClass = getGridColumnsClass(displayCount, variant);
  const tileSizeClass = getTileClasses(displayCount, variant);
  const isGalleryMulti = images.length >= 2;
  const showEditorHeader = editable && variant === 'editor' && isGalleryMulti;

  const handleTileClick = (idx: number, e: React.MouseEvent) => {
    if (onImageClick) {
      onImageClick(idx, e);
      return;
    }
    if (!interactive) return;
    e.stopPropagation();
    setLightboxIndex(idx);
  };

  return (
    <div
      data-keep-gallery-ui={interactive || editable ? 'true' : undefined}
      className={`w-full max-w-full min-w-0 ${
        showEditorHeader
          ? 'rounded-xl border border-stone-200/80 dark:border-stone-700/70 bg-black/[0.02] dark:bg-white/[0.025] p-1.5 sm:p-2'
          : ''
      } ${className}`}
    >
      {/* Editor Gallery Micro-Bar */}
      {showEditorHeader && (
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5 mb-1.5 border-b border-black/[0.05] dark:border-white/[0.06] text-[11px] text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5 min-w-0 font-medium">
            <Images className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">
              {headerLabel || `Gallery · ${images.length} images`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onAddImages && (
              <>
                <input
                  ref={addInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = e.target.files ? Array.from(e.target.files) : [];
                    e.target.value = '';
                    if (list.length > 0) onAddImages(list);
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/[0.05] hover:bg-black/[0.09] dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-stone-700 dark:text-stone-200 font-medium transition-colors cursor-pointer"
                  title="Add more images to this gallery"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </>
            )}

            {onUngroup && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUngroup();
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.09] text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors cursor-pointer"
                title="Separate into individual stacked images"
              >
                <Rows3 className="w-3 h-3" />
                <span className="hidden sm:inline">Separate</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Responsive Image Grid */}
      <div
        className={`relative grid w-full min-w-0 ${
          variant === 'card' ? 'gap-1' : 'gap-1.5 sm:gap-2'
        } ${gridColsClass}`}
      >
        {displayedImages.map((img, idx) => {
          const tileKey = `${idx}-${img.src}`;
          const useTitle = Boolean(fallbackTitleKeys[tileKey] && img.title);
          const resolvedSrc = resolveLocalMediaUrl(
            useTitle ? img.title || '' : img.src || img.title || ''
          );
          const isOverflowTile = hiddenCount > 0 && idx === displayedImages.length - 1;

          return (
            <div
              key={tileKey}
              onClick={(e) => handleTileClick(idx, e)}
              className={`group/tile relative min-w-0 overflow-hidden ${
                variant === 'card' ? 'rounded-lg' : 'rounded-xl'
              } border border-black/[0.08] dark:border-white/[0.09] bg-black/[0.04] dark:bg-white/[0.04] ${tileSizeClass} ${
                interactive || onImageClick ? 'cursor-pointer' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedSrc}
                alt={img.alt || `Image ${idx + 1}`}
                loading="lazy"
                draggable={false}
                onError={() => {
                  if (img.title && !fallbackTitleKeys[tileKey]) {
                    setFallbackTitleKeys((prev) => ({ ...prev, [tileKey]: true }));
                  }
                }}
                className={`keep-gallery-img w-full h-full ${
                  displayCount === 1
                    ? 'object-contain max-h-[inherit]'
                    : 'object-cover'
                } ${
                  interactive ? 'transition-transform duration-200 group-hover/tile:scale-103' : ''
                }`}
              />

              {/* Overflow +N Overlay on Cards */}
              {isOverflowTile && (
                <div className="absolute inset-0 bg-black/55 group-hover/tile:bg-black/45 transition-colors backdrop-blur-[1px] flex items-center justify-center text-white font-bold text-base sm:text-lg tracking-tight pointer-events-none">
                  +{hiddenCount}
                </div>
              )}

              {/* Card Gallery Count Pill on first tile when >= 3 images and no +N overlay */}
              {variant === 'card' && !isOverflowTile && images.length >= 3 && idx === 0 && (
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold inline-flex items-center gap-1 pointer-events-none">
                  <Images className="w-2.5 h-2.5" />
                  <span>{images.length}</span>
                </div>
              )}

              {/* Interactive Lightbox Hover Hint */}
              {interactive && !isOverflowTile && (
                <div className="pointer-events-none hidden sm:flex absolute inset-0 bg-black/20 opacity-0 group-hover/tile:opacity-100 transition-opacity items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5 drop-shadow-md" />
                </div>
              )}

              {/* Reorder Controls in Editable Mode */}
              {editable && onMoveImage && images.length >= 2 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-1 left-1 flex items-center gap-0.5 opacity-85 sm:opacity-0 sm:group-hover/tile:opacity-100 transition-opacity z-10"
                >
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onMoveImage(idx, idx - 1);
                      }}
                      className="p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
                      title="Move earlier"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  )}
                  {idx < images.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onMoveImage(idx, idx + 1);
                      }}
                      className="p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
                      title="Move later"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Remove Image Button (accessible on small touch screens too) */}
              {editable && onRemoveImage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveImage(idx);
                  }}
                  className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/65 hover:bg-red-600 text-white opacity-90 sm:opacity-0 sm:group-hover/tile:opacity-100 transition-all cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Built-in Interactive Lightbox */}
      {interactive && !onImageClick && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ImageGalleryLightbox
            images={images}
            initialIndex={lightboxIndex ?? 0}
            isOpen={lightboxIndex !== null}
            onClose={() => setLightboxIndex(null)}
            onDeleteIndex={editable && onRemoveImage ? onRemoveImage : undefined}
          />
        </div>
      )}
    </div>
  );
};
