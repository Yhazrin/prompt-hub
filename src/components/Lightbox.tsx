'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { spring, fadeSlide, lightboxOverlay } from '@/lib/animations';
import { getCatColors, timeAgo } from '@/lib/utils';
import { CopyButton } from './CopyButton';
import { useGallery } from '@/hooks/useGallery';
import type { Prompt } from '@/lib/types';

interface LightboxProps {
  prompt: Prompt | null;
  onClose: () => void;
}

export function Lightbox({ prompt, onClose }: LightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { images: gallery } = useGallery(prompt?.id ?? null);

  // Focus trap
  useEffect(() => {
    if (!prompt) return;
    const prev = document.activeElement as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !overlayRef.current) return;
      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      prev?.focus();
    };
  }, [prompt]);

  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          variants={lightboxOverlay}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Content */}
          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-strong noise rounded-[24px] shadow-[var(--shadow-glass-lg)]"
            variants={fadeSlide}
            transition={spring.snappy}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <motion.button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full glass flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
              whileTap={{ scale: 0.9 }}
              transition={spring.bouncy}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </motion.button>

            <div className="flex flex-col lg:flex-row">
              {/* Image */}
              {prompt.image_url && (
                <motion.div
                  className="lg:w-1/2 shrink-0"
                  layoutId={`card-image-${prompt.id}`}
                  transition={spring.snappy}
                >
                  <img
                    src={prompt.image_url}
                    alt={prompt.title}
                    className="w-full h-full object-cover lg:rounded-l-[24px]"
                    style={{ aspectRatio: prompt.ratio || '4/5' }}
                  />
                </motion.div>
              )}

              {/* Details */}
              <div className="flex-1 p-6 sm:p-8">
                {/* Category badge */}
                <div className="flex items-center gap-2 mb-4">
                  {(() => {
                    const colors = getCatColors(prompt.category_id);
                    return (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{ background: colors.bg, color: colors.label }}
                      >
                        {prompt.category_name || prompt.subcategory}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {timeAgo(prompt.updated_at)}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] mb-4 leading-tight">
                  {prompt.title}
                </h2>

                {/* Prompt text */}
                <div className="relative mb-6">
                  <div className="bg-[var(--color-surface-dim)] rounded-[16px] p-4 sm:p-5 font-mono text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {prompt.prompt_text}
                  </div>
                  <div className="absolute top-3 right-3">
                    <CopyButton text={prompt.prompt_text} />
                  </div>
                </div>

                {/* Tags */}
                {prompt.tags && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {prompt.tags.split(',').filter(Boolean).map(tag => (
                      <span
                        key={tag}
                        className="rounded-full px-2.5 py-1 text-[10px] font-medium bg-[var(--color-surface-dim)] text-[var(--color-text-secondary)]"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Gallery */}
                {gallery.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                      Gallery ({gallery.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {gallery.map(img => (
                        <motion.div
                          key={img.id}
                          className="rounded-[12px] overflow-hidden aspect-square"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={spring.gentle}
                        >
                          <img
                            src={img.url}
                            alt={img.original_name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="mt-6 pt-4 border-t border-[var(--color-glass-border-subtle)] flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
                  {prompt.view_count !== undefined && (
                    <span>{prompt.view_count} 次查看</span>
                  )}
                  {prompt.source_url && (
                    <a
                      href={prompt.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      查看来源
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
