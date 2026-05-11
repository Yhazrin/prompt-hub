import { NextResponse } from 'next/server';
import { getLastSync } from '@server/database.mjs';

export async function GET() {
  try {
    return NextResponse.json({ last_sync: getLastSync(), server_time: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
