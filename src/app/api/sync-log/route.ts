import { NextResponse } from 'next/server';
import { getSyncLog } from '@server/database.mjs';
import { withCache } from '@/lib/api-cache';

export async function GET() {
  try {
    return withCache(getSyncLog(), 10, 30);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
