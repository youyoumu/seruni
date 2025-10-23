import { Roarr as log_, ROARR } from "roarr";

class Log {
  url = "";
  client: WebSocket | undefined;
  retryCount = 0;
  retryTimer: NodeJS.Timeout | null = null;
  maxDelay = 16000;
  reconnecting = false;
  queue: string[] = [];
  status: "connecting" | "connected" | "disconnected" = "disconnected";

  constructor() {
    const url = localStorage.getItem("logServerUrl");
    if (!url) this.url = "ws://localhost:33434";

    ROARR.write = (message) => {
      if (this.client?.readyState === WebSocket.OPEN) {
        this.client.send(`${message}`);
      } else {
        this.queue.push(`${message}`);
      }
    };
  }

  async connect() {
    try {
      if (this.reconnecting) return;
      this.status = "connecting";
      this.client = new WebSocket(this.url);

      this.client.addEventListener("open", () => {
        this.retryCount = 0;
        this.status = "connected";
        console.info(`[LOG] Connected to log server at ${this.url}`);
        this.flushQueue();
      });

      this.client.addEventListener("error", () => {
        if (this.status === "disconnected") return;
        console.warn(`[LOG] Failed to connect on ${this.url}`);
        this.reconnect();
      });

      this.client.addEventListener("close", () => {
        if (this.status === "disconnected") return;
        if (!this.reconnecting) {
          console.error("[LOG] Connection closed");
        }
        this.reconnect();
      });
    } catch {
      console.warn(`[LOG] Failed to connect on ${this.url}`);
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount); // exponential backoff
    if (this.retryCount > 4) {
      console.info(`[LOG] Retry count exceeded, stopping retrying`);
      this.close();
      return;
    }
    console.info(`[LOG] Reconnecting in ${delay / 1000} seconds...`);

    this.retryCount++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.reconnecting = false;
      this.connect();
    }, delay);
  }

  close() {
    this.reconnecting = false;
    this.status = "disconnected";
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
  }

  flushQueue() {
    while (this.queue.length && this.client?.readyState === WebSocket.OPEN) {
      const txt = this.queue.shift();
      if (txt) this.client.send(txt);
    }
  }
}

const logClient = new Log();
logClient.connect();

export const log__ = log_.child((message) => {
  const message_ = {
    ...message,
    context: {
      ...message.context,
    },
  };

  return message_;
});

declare global {
  var log: typeof log__;
}

if (!window.log) window.log = log__;
