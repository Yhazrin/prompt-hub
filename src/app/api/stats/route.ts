import { NextResponse } from 'next/server';
import { getStats } from '@server/database.mjs';
import { withCache } from '@/lib/api-cache';

export async function GET() {
  try {
    return withCache(getStats(), 30, 120);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
