import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/events")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          start(controller) {
            const sendEvent = (data: unknown) => {
              const formatted = `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(formatted));
            };

            sendEvent({ type: "connected", message: "SSE connection established" });

            const interval = setInterval(() => {
              sendEvent({
                type: "ping",
                timestamp: new Date().toISOString(),
              });
            }, 5000);

            request.signal.addEventListener("abort", () => {
              clearInterval(interval);
              controller.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
