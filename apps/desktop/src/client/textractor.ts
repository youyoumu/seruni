import { randomUUID } from "node:crypto";
import type { ClientStatus } from "@repo/preload/ipc";
import { WebSocket } from "ws";
import { vnOverlayIPC } from "#/ipc/vnOverlay";
import { config } from "#/util/config";
import { log } from "../util/logger";

hmr.log(import.meta.url);

export function createTextractorClient() {
  class TextractorClient {
    history: { time: Date; text: string; uuid: string }[] = [];
    client: WebSocket | undefined;
    retryCount = 0;
    maxRetries = Infinity;
    retryTimer: NodeJS.Timeout | null = null;
    maxDelay = 16000;
    url = () =>
      `ws://127.0.0.1:${config.store.textractor.textractorWebSocketPort}`;
    reconnecting = false;
    status: ClientStatus = "disconnected";

    prepare() {
      this.connect();
    }

    connect() {
      try {
        this.reconnecting = false;
        this.status = "connecting";
        this.client = new WebSocket(this.url());

        this.client.on("open", () => {
          log.info(`Connected to Textractor on ${this.url()}`);
          this.status = "connected";
          this.retryCount = 0;
        });

        this.client.on("message", (data) => {
          const text = Buffer.isBuffer(data)
            ? data.toString("utf8")
            : data.toString();
          log.debug({ text }, "Received from Textractor");
          const payload = { time: new Date(), text, uuid: randomUUID() };
          this.history.push(payload);
          vnOverlayIPC().send("vnOverlay:sendText", payload);
        });

        this.client.on("error", (err) => {
          log.error({ error: err }, "Textractor socket error");
          this.handleDisconnect();
        });

        this.client.on("close", (code, reason) => {
          if (!this.reconnecting) {
            log.warn(
              { code, reason: reason.toString() },
              "Textractor socket closed",
            );
          }
          this.handleDisconnect();
        });
      } catch (e) {
        log.error(
          { error: e },
          `Failed to connect to Textractor on ${this.url()}`,
        );
        this.scheduleReconnect();
      }
    }

    handleDisconnect() {
      if (this.reconnecting) return;
      this.reconnecting = true;
      this.scheduleReconnect();
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

export const textractorClient = hmr.module(createTextractorClient());
