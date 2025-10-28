import { randomUUID } from "node:crypto";
import type { ClientStatus } from "@repo/preload/ipc";
import { WebSocket } from "ws";
import { vnOverlayIPC } from "#/ipc/ipcVnOverlay";
import { config } from "#/util/config";
import { logWithNamespace } from "../util/logger";

class TextractorClient {
  log = logWithNamespace("Textractor");
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
      if (this.reconnecting) return;
      this.status = "connecting";
      this.client = new WebSocket(this.url());

      this.client.on("open", () => {
        this.log.info(`Connected on ${this.url()}`);
        this.status = "connected";
        this.retryCount = 0;
      });

      this.client.on("message", (data) => {
        const text = Buffer.isBuffer(data)
          ? data.toString("utf8")
          : data.toString();
        this.log.debug({ text }, "Received text");
        const payload = { time: new Date(), text, uuid: randomUUID() };
        this.history.push(payload);
        vnOverlayIPC().send("vnOverlay:sendText", payload);
      });

      this.client.on("error", () => {
        this.log.warn(`Failed to connect on ${this.url()}`);
        this.reconnect();
      });

      this.client.on("close", () => {
        if (!this.reconnecting) {
          this.log.error("Connection closed");
        }
        this.reconnect();
      });
    } catch {
      this.log.error(`Failed to connect on ${this.url()}`);
      this.reconnect();
    }
  }

  reconnect() {
    //TODO: disable auto connect
    if (this.reconnecting || this.status === "disconnected") return;
    this.reconnecting = true;
    const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount); // exponential backoff
    this.log.info(`Reconnecting in ${delay / 1000} seconds...`);

    this.retryCount++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.reconnecting = false;
      this.connect();
    }, delay);
  }

  close() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
    this.reconnecting = false;
    this.status = "disconnected";
  }
}

export const textractorClient = hmr.module(new TextractorClient());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { textractorClient } = await hmr.register<
    typeof import("./clientTextractor")
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
