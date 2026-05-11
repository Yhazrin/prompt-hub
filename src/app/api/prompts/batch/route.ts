import { NextRequest, NextResponse } from 'next/server';
import { getPrompt, getCategories } from '@server/database.mjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = body.ids || [];
    if (ids.length === 0) return NextResponse.json([]);
    if (ids.length > 200) return NextResponse.json({ error: 'Max 200 ids per request' }, { status: 400 });

    const cats = getCategories();
    const result = ids.map((id: string) => {
      const p = getPrompt(id);
      if (!p) return null;
      return { ...p, category_name: cats.find(c => c.id === p.category_id)?.name || p.category_id };
    }).filter(Boolean);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
