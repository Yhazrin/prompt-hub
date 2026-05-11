import { NextResponse } from 'next/server';
import { triggerSync } from '@server/scheduler.mjs';

export async function POST() {
  try {
    const result = await triggerSync();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    if (err.message === 'Sync already in progress') {
      return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
