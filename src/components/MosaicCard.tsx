'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { spring, staggerItem } from '@/lib/animations';
import { getCatColors, truncate, timeAgo } from '@/lib/utils';
import { CopyButton } from './CopyButton';
import type { Prompt, GalleryImage } from '@/lib/types';

interface MosaicCardProps {
  prompt: Prompt;
  gallery?: GalleryImage[];
  onOpen: (prompt: Prompt) => void;
  index: number;
}

export function MosaicCard({ prompt, gallery, onOpen, index }: MosaicCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const colors = getCatColors(prompt.category_id);

  const imageUrl = prompt.image_url || prompt.cover_url;
  const hasImage = !!imageUrl;
  const ratio = prompt.ratio || '4 / 5';

  return (
    <motion.div
      className="mb-5 break-inside-avoid cursor-pointer"
      variants={staggerItem}
      layout
    >
      <motion.article
        className="glass noise rounded-[20px] overflow-hidden group relative"
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
        transition={spring.gentle}
        onClick={() => onOpen(prompt)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') onOpen(prompt); }}
      >
        {/* Category color strip */}
        <div
          className={`h-[3px] cat-strip-${prompt.category_id}`}
          style={{ background: colors.accent }}
        />

        {/* Image */}
        {hasImage && (
          <div className="relative overflow-hidden" style={{ aspectRatio: ratio }}>
            <motion.img
              src={imageUrl}
              alt={prompt.title}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
            />
            {!imgLoaded && (
              <div className="absolute inset-0 skeleton" />
            )}

            {/* Hover overlay with actions */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-between p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <CopyButton
                text={prompt.prompt_text}
                className="!bg-white/90 !text-[var(--color-text)] hover:!bg-white"
              />
              {gallery && gallery.length > 0 && (
                <span className="text-xs text-white/80 bg-black/30 rounded-full px-2 py-1">
                  {gallery.length} 张图
                </span>
              )}
            </motion.div>
          </div>
        )}

        {/* Content (text-only cards) */}
        {!hasImage && (
          <div className="p-4 min-h-[120px] flex items-center justify-center">
            <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface-dim)] rounded-full px-3 py-1">
              纯文本
            </span>
          </div>
        )}

        {/* Info */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1.5 line-clamp-2 leading-relaxed">
            {prompt.title}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
            {truncate(prompt.prompt_text, 100)}
          </p>
          <div className="flex items-center justify-between mt-3">
            <span
              className="text-[10px] font-medium rounded-full px-2 py-0.5"
              style={{ background: colors.bg, color: colors.label }}
            >
              {prompt.category_name || prompt.subcategory}
            </span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {timeAgo(prompt.updated_at)}
            </span>
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}
