import { syncProgress } from '@server/sync.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 15000);

      const handlers = ['start', 'nodes_fetched', 'processing', 'doc_done', 'complete', 'error'].map(
        (event) => {
          const handler = (data: unknown) => send(event, data);
          syncProgress.on(event, handler);
          return { event, handler };
        }
      );

      // Cleanup on close
      const cleanup = () => {
        clearInterval(heartbeat);
        for (const { event, handler } of handlers) {
          syncProgress.off(event, handler);
        }
      };

      // Use a pull-based approach — the stream will call cancel when the client disconnects
      // We store cleanup so it can be called
      (stream as any)._cleanup = cleanup;
    },
    cancel() {
      if ((stream as any)._cleanup) (stream as any)._cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
