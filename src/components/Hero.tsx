'use client';

import { motion } from 'framer-motion';
import { fadeSlide, spring } from '@/lib/animations';

interface HeroProps {
  total: number;
  categories: number;
}

export function Hero({ total, categories }: HeroProps) {
  return (
    <motion.section
      className="pt-28 pb-12 px-4 sm:px-6 max-w-7xl mx-auto text-center"
      initial="initial"
      animate="animate"
      variants={{
        animate: { transition: { staggerChildren: 0.1 } },
      }}
    >
      <motion.h1
        className="text-4xl sm:text-5xl font-bold text-[var(--color-text)] mb-4 tracking-tight"
        variants={fadeSlide}
        transition={spring.gentle}
      >
        AI 视觉灵感库
      </motion.h1>
      <motion.p
        className="text-lg text-[var(--color-text-secondary)] mb-8 max-w-xl mx-auto"
        variants={fadeSlide}
        transition={spring.gentle}
      >
        精选提示词合集，探索无限创意可能
      </motion.p>
      <motion.div
        className="flex items-center justify-center gap-6"
        variants={fadeSlide}
        transition={spring.gentle}
      >
        <div className="glass rounded-full px-5 py-2.5 flex items-center gap-2">
          <span className="text-2xl font-bold text-[var(--color-accent)]">{total}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">提示词</span>
        </div>
        <div className="glass rounded-full px-5 py-2.5 flex items-center gap-2">
          <span className="text-2xl font-bold text-[var(--color-accent)]">{categories}</span>
          <span className="text-sm text-[var(--color-text-secondary)]">分类</span>
        </div>
      </motion.div>
    </motion.section>
  );
}
