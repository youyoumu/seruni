import { TypesafeEventTarget } from "#/util/TypesafeEventTarget";

interface Logger {
  info: (log: string) => void;
  warn: (log: string) => void;
}

export type ReconnectingWebSocketEventMap = {
  open: undefined;
  close: undefined;
  message: unknown;
  error: Event;
};

export class ReconnectingWebSocket<
  T extends ReconnectingWebSocketEventMap = ReconnectingWebSocketEventMap,
> extends TypesafeEventTarget<T> {
  log: Logger;
  #url: string;
  #maxReconnectDelay: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #ws: WebSocket | null = null;
  #readyState: number = WebSocket.CONNECTING;
  #manualClose = false;

  constructor(options: {
    url: string;
    logger: Logger;
    maxReconnectDelay?: number;
    maxReconnectAttempts?: number;
  }) {
    super();
    this.log = options.logger;
    this.#url = options.url;
    this.#maxReconnectDelay = options.maxReconnectDelay ?? 8000;
    this.#maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
    this.#reconnectAttempts = 0;
    this.connect();
  }

  connect() {
    if (
      this.#ws &&
      (this.#readyState === WebSocket.CONNECTING || this.#readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.#ws = new WebSocket(this.#url);
    this.#readyState = WebSocket.CONNECTING;
    this.#manualClose = false;

    this.#ws.onopen = () => {
      this.log.info(`Connected to ${this.#url}`);
      this.#readyState = WebSocket.OPEN;
      this.#reconnectAttempts = 0;
      this.dispatch("open", undefined);
    };

    this.#ws.onmessage = (event) => {
      this.dispatch("message", event.data);
    };

    this.#ws.onclose = () => {
      if (this.#readyState === WebSocket.OPEN) {
        this.log.warn(`Disconnected from ${this.#url}`);
      }
      this.#ws = null;
      this.#readyState = WebSocket.CLOSED;
      this.dispatch("close", undefined);
      this.#attemptReconnect();
    };

    this.#ws.onerror = (error) => {
      this.dispatch("error", error);
    };
  }

  #attemptReconnect() {
    if (this.#manualClose) return;
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++;
      const delay = Math.min(
        1000 * Math.pow(2, this.#reconnectAttempts - 1),
        this.#maxReconnectDelay,
      );
      this.log.info(
        `Reconnecting to ${this.#url} in ${delay / 1000}s (attempt ${this.#reconnectAttempts})`,
      );
      this.#readyState = WebSocket.CONNECTING;
      setTimeout(() => this.connect(), delay);
    }
  }

  send(data: string | Blob | ArrayBuffer) {
    if (this.#ws && this.#readyState === WebSocket.OPEN) {
      this.#ws.send(data);
    }
  }

  close() {
    this.#manualClose = true;
    this.#ws?.close();
  }

  get readyState() {
    return this.#readyState;
  }
}
