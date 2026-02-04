import { Logger } from "pino";

export class ReconnectingWebsocket extends EventTarget {
  #log: Logger;
  #url: string;
  #baseReconnectInterval: number;
  #maxReconnectDelay: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #ws: WebSocket | null = null;
  #readyState: number = WebSocket.CONNECTING;

  constructor(options: {
    name: string;
    url: string;
    logger: Logger;
    baseReconnectInterval?: number;
    maxReconnectDelay?: number;
    maxReconnectAttempts?: number;
  }) {
    super();
    this.#log = options.logger.child({ name: options.name });
    this.#url = options.url;
    this.#baseReconnectInterval = options.baseReconnectInterval ?? 1000;
    this.#maxReconnectDelay = options.maxReconnectDelay ?? 8000;
    this.#maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
    this.#reconnectAttempts = 0;
    this.#connect();
  }

  #connect() {
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
      if (this.#readyState === WebSocket.OPEN) {
        this.#log.warn(`Disconnected from ${this.#url}`);
      }
      this.#readyState = WebSocket.CLOSED;
      this.dispatchEvent(new CustomEvent("close"));
      this.#attemptReconnect();
    };

    this.#ws.onerror = (error) => {
      this.dispatchEvent(new CustomEvent("error", { detail: error }));
    };
  }

  #attemptReconnect() {
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++;
      const delay = Math.min(
        this.#baseReconnectInterval * Math.pow(2, this.#reconnectAttempts - 1),
        this.#maxReconnectDelay,
      );
      this.#log.info(
        `Reconnecting to ${this.#url} in ${delay / 1000}s (attempt ${this.#reconnectAttempts})`,
      );
      this.#readyState = WebSocket.CONNECTING;
      setTimeout(() => this.#connect(), delay);
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
