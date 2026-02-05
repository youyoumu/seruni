import { createContext, useContext, useEffect } from "react";

const sseEmitter = new EventTarget();

const SSEContext = createContext<EventTarget>(sseEmitter);

export function SSEProvider({ url, children }: { url: string; children: React.ReactNode }) {
  useEffect(() => {
    const es = new EventSource(url);

    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      console.log("DEBUG[1498]: parsed=", parsed);
      // Dispatch a generic message event
      sseEmitter.dispatchEvent(new CustomEvent("message", { detail: parsed }));

      // If your server sends 'type', you can dispatch specific events
      if (parsed.type) {
        sseEmitter.dispatchEvent(new CustomEvent(parsed.type, { detail: parsed }));
      }
    };

    es.onerror = (err) => console.error("SSE Connection Error", err);

    return () => es.close();
  }, [url]);

  return <SSEContext.Provider value={sseEmitter}>{children}</SSEContext.Provider>;
}

export function useSSEListener(eventType: string, callback: (data: any) => void) {
  const emitter = useContext(SSEContext);

  useEffect(() => {
    const handler = (event: Event) => {
      callback((event as CustomEvent).detail);
    };

    emitter.addEventListener(eventType, handler);
    return () => emitter.removeEventListener(eventType, handler);
  }, [emitter, eventType, callback]);
}
