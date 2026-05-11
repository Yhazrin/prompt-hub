'use client';

import { useState, useMemo, use } from 'react';
import { usePrompts } from '@/hooks/usePrompts';
import { useCategories } from '@/hooks/useCategories';
import { useGalleryBatch } from '@/hooks/useGallery';
import { useLightbox } from '@/hooks/useLightbox';
import { Topbar } from '@/components/Topbar';
import { CategoryPills } from '@/components/CategoryPills';
import { MosaicGrid } from '@/components/MosaicGrid';
import { Lightbox } from '@/components/Lightbox';
import { Footer } from '@/components/Footer';
import { motion } from 'framer-motion';
import { fadeSlide, spring } from '@/lib/animations';
import { getCatColors } from '@/lib/utils';
import useSWR from 'swr';
import { swrKeys, fetcher } from '@/lib/api';
import type { Subcategory } from '@/lib/types';

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const { categories } = useCategories();
  const { prompts, isLoading } = usePrompts({
    category: id,
    sub: activeSub || undefined,
    limit: 200,
  });
  const { galleryMap } = useGalleryBatch(prompts.map(p => p.id));
  const { activePrompt, open, close } = useLightbox();

  const { data: subs } = useSWR<Subcategory[]>(
    swrKeys.subs(id),
    fetcher,
    { revalidateOnFocus: false }
  );

  const category = categories.find(c => c.id === id);
  const colors = getCatColors(id);

  return (
    <>
      <Topbar />

      <main className="min-h-screen">
        {/* Category header */}
        <section className="pt-28 pb-8 px-4 sm:px-6 max-w-7xl mx-auto">
          <motion.div
            className="text-center"
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-4"
              style={{ background: colors.bg }}
              variants={fadeSlide}
              transition={spring.gentle}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.accent }} />
              <span className="text-sm font-medium" style={{ color: colors.label }}>
                {category?.name || id}
              </span>
            </motion.div>
            <motion.h1
              className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-2"
              variants={fadeSlide}
              transition={spring.gentle}
            >
              {category?.name || id}
            </motion.h1>
            <motion.p
              className="text-[var(--color-text-secondary)]"
              variants={fadeSlide}
              transition={spring.gentle}
            >
              {prompts.length} 个提示词
            </motion.p>
          </motion.div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          {/* Category navigation */}
          <div className="mb-6">
            <CategoryPills
              categories={categories}
              activeId={id}
              onSelect={catId => {
                if (catId) window.location.href = `/cat/${catId}`;
                else window.location.href = '/';
              }}
            />
          </div>

          {/* Subcategory pills */}
          {subs && subs.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              <SubPill
                label="全部"
                isActive={activeSub === null}
                onClick={() => setActiveSub(null)}
                accent={colors.accent}
              />
              {subs.map(sub => (
                <SubPill
                  key={sub.subcategory}
                  label={sub.subcategory}
                  count={sub.count}
                  isActive={activeSub === sub.subcategory}
                  onClick={() => setActiveSub(sub.subcategory)}
                  accent={colors.accent}
                />
              ))}
            </div>
          )}

          {/* Grid */}
          <MosaicGrid
            prompts={prompts}
            galleryMap={galleryMap}
            isLoading={isLoading}
            onOpenLightbox={open}
          />
        </section>

        <Footer />
      </main>

      <Lightbox prompt={activePrompt} onClose={close} />
    </>
  );
}

function SubPill({
  label,
  count,
  isActive,
  onClick,
  accent,
}: {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1 ${
        isActive
          ? 'text-white shadow-sm'
          : 'bg-[var(--color-surface-dim)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
      }`}
      style={{ background: isActive ? accent : undefined }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    >
      {label}
      {count !== undefined && (
        <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
          {count}
        </span>
      )}
    </motion.button>
  );
}
