import { NextResponse } from 'next/server';
import { getStats } from '@server/database.mjs';

export async function GET() {
  try {
    return NextResponse.json(getStats());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
