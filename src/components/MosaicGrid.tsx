'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/animations';
import { MosaicCard } from './MosaicCard';
import { MosaicSkeleton } from './Skeleton';
import type { Prompt, GalleryImage } from '@/lib/types';

interface MosaicGridProps {
  prompts: Prompt[];
  galleryMap: Record<string, GalleryImage[]>;
  isLoading: boolean;
  isLoadingMore?: boolean;
  isReachingEnd?: boolean;
  onLoadMore?: () => void;
  onOpenLightbox: (prompt: Prompt) => void;
}

export function MosaicGrid({
  prompts,
  galleryMap,
  isLoading,
  isLoadingMore,
  isReachingEnd,
  onLoadMore,
  onOpenLightbox,
}: MosaicGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current || !onLoadMore || isReachingEnd) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [onLoadMore, isLoadingMore, isReachingEnd]);

  if (isLoading && prompts.length === 0) {
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
    <>
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

      {/* Infinite scroll sentinel */}
      {!isReachingEnd && onLoadMore && (
        <div ref={sentinelRef} className="py-8 text-center">
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse [animation-delay:0.15s]" />
              <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse [animation-delay:0.3s]" />
            </div>
          )}
        </div>
      )}

      {isReachingEnd && prompts.length > 0 && (
        <div className="text-center py-8">
          <span className="text-xs text-[var(--color-text-secondary)] opacity-50">
            已加载全部 {prompts.length} 个提示词
          </span>
        </div>
      )}
    </>
  );
}
