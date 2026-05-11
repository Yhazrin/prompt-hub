'use client';

import { motion } from 'framer-motion';
import { spring } from '@/lib/animations';
import { getCatColors } from '@/lib/utils';
import type { Category } from '@/lib/types';

interface CategoryPillsProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryPills({ categories, activeId, onSelect }: CategoryPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 justify-center">
      <PillButton
        label="全部"
        count={categories.reduce((s, c) => s + c.prompt_count, 0)}
        isActive={activeId === null}
        onClick={() => onSelect(null)}
        accent="var(--color-accent)"
        bg="var(--color-accent-light)"
      />
      {categories.map(cat => {
        const colors = getCatColors(cat.id);
        return (
          <PillButton
            key={cat.id}
            label={cat.name}
            count={cat.prompt_count}
            isActive={activeId === cat.id}
            onClick={() => onSelect(cat.id)}
            accent={colors.accent}
            bg={colors.bg}
          />
        );
      })}
    </div>
  );
}

function PillButton({
  label,
  count,
  isActive,
  onClick,
  accent,
  bg,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  accent: string;
  bg: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
        isActive
          ? 'text-white shadow-sm'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
      }`}
      style={{
        background: isActive ? accent : bg,
        color: isActive ? '#fff' : undefined,
      }}
      whileTap={{ scale: 0.93 }}
      transition={spring.bouncy}
      layout
    >
      {label}
      <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
        {count}
      </span>
    </motion.button>
  );
}
