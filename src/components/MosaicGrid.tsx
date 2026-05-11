'use client';

import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/animations';
import { MosaicCard } from './MosaicCard';
import { MosaicSkeleton } from './Skeleton';
import type { Prompt, GalleryImage } from '@/lib/types';

interface MosaicGridProps {
  prompts: Prompt[];
  galleryMap: Record<string, GalleryImage[]>;
  isLoading: boolean;
  onOpenLightbox: (prompt: Prompt) => void;
}

export function MosaicGrid({ prompts, galleryMap, isLoading, onOpenLightbox }: MosaicGridProps) {
  if (isLoading) {
    return <MosaicSkeleton count={12} />;
  }

  if (prompts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="glass noise rounded-[20px] inline-block px-8 py-6">
          <p className="text-[var(--color-text-secondary)]">暂无提示词</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="mosaic-grid"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {prompts.map((prompt, idx) => (
        <MosaicCard
          key={prompt.id}
          prompt={prompt}
          gallery={galleryMap[prompt.id]}
          onOpen={onOpenLightbox}
          index={idx}
        />
      ))}
    </motion.div>
  );
}
