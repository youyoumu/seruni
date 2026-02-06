export class ReconnectingWebsocket extends EventTarget {
  name: string;
  #url: string;
  #baseReconnectInterval: number;
  #maxReconnectDelay: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #ws: WebSocket | null = null;
  #readyState: number = WebSocket.CONNECTING;
  #manualClose = false;

  constructor(options: {
    name: string;
    url: string;
    baseReconnectInterval?: number;
    maxReconnectDelay?: number;
    maxReconnectAttempts?: number;
  }) {
    super();
    this.name = options.name;
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
      this.#manualClose = false;
      console.log(`Connected to ${this.#url}`);
      this.#readyState = WebSocket.OPEN;
      this.#reconnectAttempts = 0;
      this.dispatchEvent(new CustomEvent("open"));
    };

    this.#ws.onmessage = (event) => {
      this.dispatchEvent(new CustomEvent("message", { detail: event.data }));
    };

    this.#ws.onclose = () => {
      if (this.#readyState === WebSocket.OPEN) {
        console.log(`Disconnected from ${this.#url}`);
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
    if (this.#manualClose) return;
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++;
      const delay = Math.min(
        this.#baseReconnectInterval * Math.pow(2, this.#reconnectAttempts - 1),
        this.#maxReconnectDelay,
      );
      console.log(
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
    this.#manualClose = true;
    this.#ws?.close();
  }

  getReadyState() {
    return this.#readyState;
  }
}
