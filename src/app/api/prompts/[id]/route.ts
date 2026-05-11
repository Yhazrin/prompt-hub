import { NextRequest, NextResponse } from 'next/server';
import { getPrompt, incrementViewCount } from '@server/database.mjs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prompt = getPrompt(id);
    if (!prompt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    incrementViewCount(id);
    return NextResponse.json(prompt);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
