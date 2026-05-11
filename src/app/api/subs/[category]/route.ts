import { NextRequest, NextResponse } from 'next/server';
import { getSubs } from '@server/database.mjs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    return NextResponse.json(getSubs(category));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
