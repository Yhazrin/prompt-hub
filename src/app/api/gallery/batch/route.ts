import { NextRequest, NextResponse } from 'next/server';
import { getGalleryImagesBatch } from '@server/database.mjs';

export async function GET(req: NextRequest) {
  try {
    const idsStr = req.nextUrl.searchParams.get('ids') || '';
    const ids = idsStr.split(',').filter(Boolean);
    if (ids.length === 0) return NextResponse.json({});
    if (ids.length > 200) return NextResponse.json({ error: 'Max 200 ids per request' }, { status: 400 });

    return NextResponse.json(getGalleryImagesBatch(ids));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
