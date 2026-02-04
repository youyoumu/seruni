export class ReconnectingWebsocket extends EventTarget {
  #url: string;
  #reconnectInterval: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #ws: WebSocket | null = null;
  #readyState: number = WebSocket.CONNECTING;

  constructor(
    url: string,
    options: { reconnectInterval?: number; maxReconnectAttempts?: number } = {}
  ) {
    super();
    this.#url = url;
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
        this.#readyState = WebSocket.OPEN;
        this.#reconnectAttempts = 0;
        this.dispatchEvent(new CustomEvent("open"));
      };

      this.#ws.onmessage = (event) => {
        this.dispatchEvent(new CustomEvent("message", { detail: event.data }));
      };

      this.#ws.onclose = () => {
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
