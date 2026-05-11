import { NextRequest, NextResponse } from 'next/server';
import { getSubs } from '@server/database.mjs';
import { withCache } from '@/lib/api-cache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    return withCache(getSubs(category), 60, 300);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
