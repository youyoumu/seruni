import { TypesafeEventTarget } from "@repo/shared/util";
import { YankiConnect, type YankiConnectOptions } from "yanki-connect";

interface Logger {
  info: (log: string) => void;
  warn: (log: string) => void;
}

export type ReconnectingAnkiConnectEventMap = {
  open: undefined;
  close: undefined;
};

export class ReconnectingAnkiConnect extends TypesafeEventTarget<ReconnectingAnkiConnectEventMap> {
  log: Logger;
  #yankiConnect: YankiConnect;
  #baseReconnectInterval: number;
  #maxReconnectDelay: number;
  #maxReconnectAttempts: number;
  #reconnectAttempts: number;
  #pollIntervalId: ReturnType<typeof setInterval> | null = null;
  #isConnected = false;
  #abortController: AbortController | null = null;
  #manualClose = false;
  #pollInterval: number;

  constructor(options: {
    yankiConnectOptions?: Partial<YankiConnectOptions>;
    logger: Logger;
    baseReconnectInterval?: number;
    maxReconnectDelay?: number;
    maxReconnectAttempts?: number;
    pollInterval?: number;
  }) {
    super();
    this.log = options.logger;
    this.#yankiConnect = new YankiConnect(options.yankiConnectOptions);
    this.#baseReconnectInterval = options.baseReconnectInterval ?? 1000;
    this.#maxReconnectDelay = options.maxReconnectDelay ?? 8000;
    this.#maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
    this.#reconnectAttempts = 0;
    this.#pollInterval = options.pollInterval ?? 5000;
    this.connect();
  }

  get client(): YankiConnect {
    return this.#yankiConnect;
  }

  async #checkConnection(): Promise<boolean> {
    try {
      const version = await this.#yankiConnect.miscellaneous.version();
      return typeof version === "number";
    } catch {
      return false;
    }
  }

  connect() {
    if (this.#pollIntervalId) return;
    this.#manualClose = false;
    this.#startPolling();
  }

  async #startPolling() {
    const checkAndNotify = async () => {
      if (this.#abortController?.signal.aborted) return;
      this.#abortController?.abort();
      const abortController = new AbortController();
      this.#abortController = abortController;

      if (this.#manualClose) {
        this.#stopPolling();
        return;
      }

      if (abortController.signal.aborted) return;
      const wasConnected = this.#isConnected;
      const nowConnected = await this.#checkConnection();
      if (abortController.signal.aborted) return;

      if (nowConnected && !wasConnected) {
        this.log.info(`Connected to Anki Connect`);
        this.#isConnected = true;
        this.#reconnectAttempts = 0;
        this.dispatch("open");
      } else if (!nowConnected && wasConnected) {
        this.log.warn(`Disconnected from Anki Connect`);
        this.#isConnected = false;
        this.dispatch("close");
        this.#attemptReconnect();
      } else if (!nowConnected) {
        this.#isConnected = false;
        this.dispatch("close");
        this.log.warn(`Unable to connect to Anki Connect`);
        this.#attemptReconnect();
      }
    };

    checkAndNotify();

    this.#pollIntervalId = setInterval(checkAndNotify, this.#pollInterval);
  }

  #stopPolling() {
    this.#abortController?.abort();
    this.#abortController = null;
    if (this.#pollIntervalId) {
      clearInterval(this.#pollIntervalId);
      this.#pollIntervalId = null;
    }
  }

  #attemptReconnect() {
    this.#stopPolling();

    if (this.#manualClose) return;
    if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
      this.#reconnectAttempts++;
      const delay = Math.min(
        this.#baseReconnectInterval * Math.pow(2, this.#reconnectAttempts - 1),
        this.#maxReconnectDelay,
      );
      this.log.info(
        `Reconnecting to Anki Connect in ${delay / 1000}s (attempt ${this.#reconnectAttempts})`,
      );
      setTimeout(() => this.#startPolling(), delay);
    }
  }

  close() {
    this.#manualClose = true;
    this.#stopPolling();
    this.#isConnected = false;
  }

  get isConnected() {
    return this.#isConnected;
  }
}
