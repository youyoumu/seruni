import { randomUUID } from "node:crypto";
import type { ClientStatus } from "@repo/preload/ipc";
import { WebSocket } from "ws";
import { vnOverlayIPC } from "#/ipc/vnOverlay";
import { config } from "#/util/config";
import { log } from "../util/logger";

hmr.log(import.meta);

class TextractorClient {
  history: { time: Date; text: string; uuid: string }[] = [];
  client: WebSocket | undefined;
  retryCount = 0;
  retryTimer: NodeJS.Timeout | null = null;
  maxDelay = 16000;
  url = () =>
    `ws://localhost:${config.store.textractor.textractorWebSocketPort}`;
  reconnecting = false;
  status: ClientStatus = "disconnected";

  async connect() {
    try {
      this.reconnecting = false;
      this.status = "connecting";
      this.client = new WebSocket(this.url());

      this.client.on("open", () => {
        log.info(`Textractor: Connected on ${this.url()}`);
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

      this.client.on("error", () => {
        log.warn(`Textractor: Failed to connect on ${this.url()}`);
        this.handleDisconnect();
      });

      this.client.on("close", () => {
        if (!this.reconnecting) {
          log.error("Textractor: Connection closed");
        }
        this.handleDisconnect();
      });
    } catch {
      log.error(`Textractor: Failed to connect on ${this.url()}`);
      this.scheduleReconnect();
    }
  }

  handleDisconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount); // exponential backoff
    log.info(`Textractor: Reconnecting in ${delay / 1000} seconds...`);
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

export const textractorClient = hmr.module(new TextractorClient());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { textractorClient } = await hmr.register<
    typeof import("./textractor")
  >(import.meta);
  hmr.register(import.meta);
  import.meta.hot.accept(async (mod) => {
    hmr.update(import.meta, mod);
    await textractorClient().connect();
  });
  import.meta.hot.dispose(() => {
    textractorClient().close();
  });
}
