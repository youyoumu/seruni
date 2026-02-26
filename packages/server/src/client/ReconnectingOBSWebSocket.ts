import { TypesafeEventTarget } from "@repo/shared/util";
import OBSWebSocket, {
  type OBSRequestTypes,
  type OBSResponseTypes,
  type OBSEventTypes,
  type OBSWebSocketError,
} from "obs-websocket-js";

interface Logger {
  info: (log: string) => void;
  warn: (log: string) => void;
}

export type OBSEvent = OBSEventTypes[keyof OBSEventTypes];

export type ReconnectingObsEventMap = {
  open: undefined;
  close: undefined;
  error: Error;
  event: OBSEvent;
};

export class ReconnectingOBSWebSocket extends TypesafeEventTarget<ReconnectingObsEventMap> {
  log: Logger;
  #obs: OBSWebSocket;
  #url: string;
  #password: string | undefined;
  #maxReconnectDelay: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #attemptReconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  #isConnected = false;
  #manualClose = false;

  constructor(options: {
    url: string;
    password?: string;
    logger: Logger;
    baseReconnectInterval?: number;
    maxReconnectDelay?: number;
    maxReconnectAttempts?: number;
  }) {
    super();
    this.log = options.logger;
    this.#obs = new OBSWebSocket();
    this.#url = options.url;
    this.#password = options.password;
    this.#maxReconnectDelay = options.maxReconnectDelay ?? 8000;
    this.#maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
    this.#reconnectAttempts = 0;
    this.#setupEventListeners();
    void this.connect();
  }

  get client(): OBSWebSocket {
    return this.#obs;
  }

  #setupEventListeners() {
    this.#obs.on("Identified", () => {
      this.log.info(`Connected to ${this.#url}`);
      this.#isConnected = true;
      this.#reconnectAttempts = 0;
      this.dispatch("open");
    });

    this.#obs.on("ConnectionClosed", () => {
      if (this.#isConnected) {
        this.log.warn(`Disconnected from ${this.#url}`);
      }
      this.#isConnected = false;
      this.dispatch("close", undefined);
      this.#attemptReconnect();
    });

    this.#obs.on("ConnectionError", (event: OBSWebSocketError) => {
      this.dispatch("error", event);
    });
  }

  async connect() {
    if (this.#isConnected) return;
    this.#manualClose = false;

    try {
      await this.#obs.connect(this.#url, this.#password);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.dispatch("error", error instanceof Error ? error : new Error(message));
      this.#attemptReconnect();
    }
  }

  #attemptReconnect() {
    if (this.#manualClose) return;
    if (this.#attemptReconnectTimeoutId) return;
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++;
      const delay = Math.min(
        1000 * Math.pow(2, this.#reconnectAttempts - 1),
        this.#maxReconnectDelay,
      );
      this.log.info(
        `Reconnecting to ${this.#url} in ${delay / 1000}s (attempt ${this.#reconnectAttempts})`,
      );
      this.#attemptReconnectTimeoutId = setTimeout(async () => {
        this.#attemptReconnectTimeoutId = null;
        await this.connect();
      }, delay);
    }
  }

  async call<K extends keyof OBSRequestTypes>(
    requestType: K,
    requestData?: OBSRequestTypes[K],
  ): Promise<OBSResponseTypes[K]> {
    return this.#obs.call(requestType, requestData);
  }

  async close() {
    this.#manualClose = true;
    await this.#obs.disconnect();
    this.#isConnected = false;
  }

  get isConnected() {
    return this.#isConnected;
  }
}
