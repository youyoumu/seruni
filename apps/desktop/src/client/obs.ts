import type { ClientStatus } from "@repo/preload/ipc";
import OBSWebSocket from "obs-websocket-js";
import { config } from "#/util/config";
import { log } from "../util/logger";

class ObsClient {
  client: OBSWebSocket | undefined;
  url = () => `ws://localhost:${config.store.obs.obsWebSocketPort}`;
  reconnecting = false;
  retryCount = 0;
  maxDelay = 16000;
  retryTimer: NodeJS.Timeout | null = null;
  status: ClientStatus = "disconnected";

  async connect() {
    if (this.reconnecting) return;
    this.status = "connecting";
    this.client = new OBSWebSocket();

    try {
      await this.client.connect(this.url());
      log.info(`OBS: Connected on ${this.url()}`);
      this.status = "connected";
      this.retryCount = 0;

      // Auto-start Replay Buffer if not active
      log.info("OBS: Ensuring Replay Buffer is active...");
      const res = await this.client.call("GetReplayBufferStatus");
      if (!res.outputActive) {
        await this.client.call("StartReplayBuffer");
        log.info("OBS: Replay Buffer started");
      }

      // Listen for disconnections
      this.client.on("ConnectionError", () => {
        log.error("OBS: Connection error");
        this.reconnect();
      });
      this.client.on("ConnectionClosed", () => {
        if (!this.reconnecting) {
          log.error("OBS: Connection closed");
        }
        this.reconnect();
      });
    } catch {
      log.warn(`OBS: Failed to connect on ${this.url()}`);
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnecting || this.status === "disconnected") return;
    this.reconnecting = true;
    const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount); // exponential backoff
    log.info(`OBS: Reconnecting in ${delay / 1000} seconds...`);
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
      this.client.disconnect().catch(() => {});
      this.client = undefined;
    }
    this.reconnecting = false;
    this.status = "disconnected";
  }

  saveReplayBuffer() {
    if (!this.client) throw new Error("OBS client not connected");
    const { promise, resolve, reject } = Promise.withResolvers<string>();

    const handler = ({ savedReplayPath }: { savedReplayPath: string }) => {
      log.debug({ savedReplayPath }, "ReplayBufferSaved");
      this.client?.off("ReplayBufferSaved", handler);
      resolve(savedReplayPath);
    };

    this.client.on("ReplayBufferSaved", handler);
    this.client.call("SaveReplayBuffer").catch((e) => {
      this.client?.off("ReplayBufferSaved", handler);
      reject(e);
    });

    return promise;
  }
}

export const obsClient = hmr.module(new ObsClient());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { obsClient } = await hmr.register<typeof import("./obs")>(import.meta);
  hmr.register(import.meta);
  import.meta.hot.accept(async (mod) => {
    hmr.update(import.meta, mod);
    await obsClient().connect();
  });
  import.meta.hot.dispose(() => {
    obsClient().close();
  });
}
