import { NextResponse } from 'next/server';
import { getCategories } from '@server/database.mjs';
import { withCache } from '@/lib/api-cache';

export async function GET() {
  try {
    return withCache(getCategories(), 60, 300);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
