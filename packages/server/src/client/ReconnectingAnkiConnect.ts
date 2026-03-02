import { R } from "@praha/byethrow";
import { TypesafeEventTarget } from "@repo/shared/util";
import type { Logger } from "pino";
import { YankiConnect } from "yanki-connect";

export type ReconnectingAnkiConnectEventMap = {
  open: undefined;
  close: undefined;
};

function parseUrl(url: string) {
  const url_ = new URL(url);
  const port = parseInt(url_.port);
  url_.port = "";
  const newUrl = `${url_.origin}:${port}`;
  return { url: newUrl, port, host: url_.origin };
}

export class ReconnectingAnkiConnect extends TypesafeEventTarget<ReconnectingAnkiConnectEventMap> {
  log: Logger;
  url: string;
  #actualUrl: string;
  #yankiConnect: YankiConnect;
  #maxReconnectDelay: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #pollIntervalId: ReturnType<typeof setInterval> | null = null;
  #attemptReconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  #isConnected = false;
  #manualClose = false;
  #pollInterval: number;

  constructor(options: {
    log: Logger;
    url: string;
    maxReconnectDelay?: number;
    maxReconnectAttempts?: number;
    pollInterval?: number;
  }) {
    super();
    this.log = options.log;
    this.url = options.url;
    const { url, port, host } = parseUrl(this.url);
    this.#actualUrl = url;
    this.#yankiConnect = new YankiConnect({ host, port });

    this.#maxReconnectDelay = options.maxReconnectDelay ?? 8000;
    this.#maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
    this.#reconnectAttempts = 0;
    this.#pollInterval = options.pollInterval ?? 4000;
    void this.connect();
  }

  get client(): YankiConnect {
    return this.#yankiConnect;
  }

  async #checkConnection(): Promise<boolean> {
    const result = await R.try({
      try: () => this.#yankiConnect.miscellaneous.version(),
      catch: () => new Error("Failed to connect"),
    });
    if (R.isSuccess(result)) return typeof result.value === "number";
    return false;
  }

  async connect() {
    const { url, port, host } = parseUrl(this.url);
    this.#actualUrl = url;
    this.#yankiConnect = new YankiConnect({ host, port });
    if (this.#pollIntervalId) return;
    this.#manualClose = false;
    await this.#startPolling();
  }

  async #startPolling() {
    if (this.#pollIntervalId) return;
    const checkAndNotify = async () => {
      if (this.#manualClose) return this.#stopPolling();

      const wasConnected = this.#isConnected;
      const nowConnected = await this.#checkConnection();

      if (nowConnected && !wasConnected) {
        this.log.info(`Connected to ${this.#actualUrl}`);
        this.#isConnected = true;
        this.#reconnectAttempts = 0;
        this.dispatch("open");
      } else if (!nowConnected && wasConnected) {
        this.log.warn(`Disconnected from ${this.#actualUrl}`);
        this.#isConnected = false;
        this.dispatch("close");
        this.#attemptReconnect();
      } else if (!nowConnected) {
        this.#isConnected = false;
        this.dispatch("close");
        this.#attemptReconnect();
      }
    };

    this.#pollIntervalId = setInterval(checkAndNotify, this.#pollInterval);
    await checkAndNotify();
  }

  #stopPolling() {
    if (this.#pollIntervalId) {
      clearInterval(this.#pollIntervalId);
      this.#pollIntervalId = null;
    }
  }

  #attemptReconnect() {
    this.#stopPolling();

    if (this.#manualClose) return;
    if (this.#attemptReconnectTimeoutId) return;
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++;
      const delay = Math.min(
        1000 * Math.pow(2, this.#reconnectAttempts - 1),
        this.#maxReconnectDelay,
      );
      this.log.info(
        `Reconnecting to ${this.#actualUrl} in ${delay / 1000}s (attempt ${this.#reconnectAttempts})`,
      );
      this.#attemptReconnectTimeoutId = setTimeout(async () => {
        this.#attemptReconnectTimeoutId = null;
        await this.#startPolling();
      }, delay);
    }
  }

  close() {
    this.#manualClose = true;
    this.#stopPolling();
    this.#isConnected = false;
  }

  async restart() {
    this.close();
    await this.connect();
  }

  get isConnected() {
    return this.#isConnected;
  }
}
