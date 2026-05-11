import { NextResponse } from 'next/server';

export function withCache(
  data: unknown,
  maxAge: number,
  staleWhileRevalidate: number = maxAge * 5
) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    },
  });
}
