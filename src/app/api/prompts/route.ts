import { NextRequest, NextResponse } from 'next/server';
import { getPrompts, getCategories } from '@server/database.mjs';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const result = getPrompts({
      category: sp.get('category') || undefined,
      sub: sp.get('sub') || undefined,
      search: sp.get('search') || undefined,
      page: parseInt(sp.get('page') || '1'),
      limit: parseInt(sp.get('limit') || '50'),
      sort: sp.get('sort') || 'updated_at',
      order: sp.get('order') || 'desc',
    });

    const cats = getCategories();
    result.prompts = result.prompts.map(p => ({
      ...p,
      category_name: cats.find(c => c.id === p.category_id)?.name || p.category_id,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
