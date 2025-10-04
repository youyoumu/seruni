import { signal } from "alien-signals";
import { WebSocket } from "ws";
import { log } from "../util/logger";

export function createTextractorClient() {
  class TextractorClient {
    history: { time: Date; text: string }[] = [];
    client: WebSocket | undefined;
    retryCount = 0;
    maxRetries = Infinity; // retry forever
    retryTimer: NodeJS.Timeout | null = null;
    maxDelay = 16000;
    url = "ws://127.0.0.1:6677";
    reconnecting = false; // 👈 prevents double reconnect

    prepare() {
      this.connect();
    }

    connect() {
      try {
        this.reconnecting = false;
        this.client = new WebSocket(this.url);

        this.client.on("open", () => {
          log.info("Connected to Textractor");
          this.retryCount = 0;
        });

        this.client.on("message", (data) => {
          const text = Buffer.isBuffer(data)
            ? data.toString("utf8")
            : data.toString();
          log.debug({ text }, "Received from Textractor");
          this.history.push({ time: new Date(), text });
        });

        const handleDisconnect = () => {
          if (this.reconnecting) return;
          this.reconnecting = true;
          this.scheduleReconnect();
        };

        this.client.on("error", (err) => {
          log.error({ error: err }, "Textractor socket error");
          handleDisconnect();
        });

        this.client.on("close", (code, reason) => {
          if (!this.reconnecting) {
            log.warn(
              { code, reason: reason.toString() },
              "Textractor socket closed",
            );
          }
          handleDisconnect();
        });
      } catch (e) {
        log.error({ error: e }, "Failed to create Textractor connection");
        this.scheduleReconnect();
      }
    }

    scheduleReconnect() {
      if (this.retryCount >= this.maxRetries) {
        log.error("Max retries reached. Giving up on Textractor connection.");
        return;
      }

      const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount); // exponential backoff
      log.info(`Reconnecting to Textractor in ${delay / 1000} seconds...`);
      this.retryCount++;

      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    }

    close() {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      if (this.client) {
        this.client.close();
        this.client = undefined;
      }
      this.reconnecting = false;
    }
  }

  return new TextractorClient();
}

export const textractorClient = signal(createTextractorClient());
