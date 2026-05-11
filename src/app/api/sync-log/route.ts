import { NextResponse } from 'next/server';
import { getSyncLog } from '@server/database.mjs';

export async function GET() {
  try {
    return NextResponse.json(getSyncLog());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
