import { NextRequest, NextResponse } from 'next/server';
import { getPrompts, getCategories } from '@server/database.mjs';
import { withCache } from '@/lib/api-cache';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) return withCache([], 30, 120);

    const cats = getCategories();
    const result = getPrompts({ search: q, limit: 20, sort: 'updated_at' });
    result.prompts = result.prompts.map(p => ({
      ...p,
      category_name: cats.find(c => c.id === p.category_id)?.name || p.category_id,
    }));

    return withCache(result.prompts, 30, 120);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
