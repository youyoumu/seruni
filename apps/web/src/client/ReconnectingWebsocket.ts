import pino, { Logger } from "pino";
import pretty from "pino-pretty";

export class ReconnectingWebsocket extends EventTarget {
  #log: Logger;
  #url: string;
  #reconnectInterval: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #ws: WebSocket | null = null;
  #readyState: number = WebSocket.CONNECTING;

  constructor(options: {
    name: string;
    url: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  }) {
    super();
    this.#log = pino(
      { name: options.name },
      pretty({
        ignore: "pid,hostname",
        translateTime: "SYS:HH:MM:ss",
      }),
    );
    this.#url = options.url;
    this.#reconnectInterval = options.reconnectInterval ?? 1000;
    this.#maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.#reconnectAttempts = 0;
    this.#connect();
  }

  #connect() {
    try {
      this.#ws = new WebSocket(this.#url);
      this.#readyState = WebSocket.CONNECTING;

      this.#ws.onopen = () => {
        this.#log.info(`Connected to ${this.#url}`);
        this.#readyState = WebSocket.OPEN;
        this.#reconnectAttempts = 0;
        this.dispatchEvent(new CustomEvent("open"));
      };

      this.#ws.onmessage = (event) => {
        this.dispatchEvent(new CustomEvent("message", { detail: event.data }));
      };

      this.#ws.onclose = () => {
        this.#log.warn(`Disconnected from ${this.#url}`);
        this.#readyState = WebSocket.CLOSED;
        this.dispatchEvent(new CustomEvent("close"));
        this.#attemptReconnect();
      };

      this.#ws.onerror = (error) => {
        this.dispatchEvent(new CustomEvent("error", { detail: error }));
      };
    } catch {
      this.#attemptReconnect();
    }
  }

  #attemptReconnect() {
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#log.info(`Reconnecting to ${this.#url}`);
      this.#reconnectAttempts++;
      this.#readyState = WebSocket.CONNECTING;
      setTimeout(() => this.#connect(), this.#reconnectInterval);
    }
  }

  send(data: string | Blob | ArrayBuffer) {
    if (this.#ws && this.#readyState === WebSocket.OPEN) {
      this.#ws.send(data);
    }
  }

  close() {
    this.#ws?.close();
  }

  getReadyState() {
    return this.#readyState;
  }
}
