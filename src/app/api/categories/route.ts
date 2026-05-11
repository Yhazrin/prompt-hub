import { NextResponse } from 'next/server';
import { getCategories } from '@server/database.mjs';

export async function GET() {
  try {
    return NextResponse.json(getCategories());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
