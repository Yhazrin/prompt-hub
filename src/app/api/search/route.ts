import { NextRequest, NextResponse } from 'next/server';
import { getPrompts, getCategories } from '@server/database.mjs';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) return NextResponse.json([]);

    const cats = getCategories();
    const result = getPrompts({ search: q, limit: 20, sort: 'updated_at' });
    result.prompts = result.prompts.map(p => ({
      ...p,
      category_name: cats.find(c => c.id === p.category_id)?.name || p.category_id,
    }));

    return NextResponse.json(result.prompts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
