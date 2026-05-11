import { NextRequest, NextResponse } from 'next/server';
import { toggleFavorite } from '@server/database.mjs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = toggleFavorite(id);
    if (result === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ favorite: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
