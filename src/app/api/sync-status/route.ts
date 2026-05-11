import { NextResponse } from 'next/server';
import { getLastSync } from '@server/database.mjs';
import { withCache } from '@/lib/api-cache';

export async function GET() {
  try {
    return withCache({ last_sync: getLastSync(), server_time: new Date().toISOString() }, 10, 30);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
