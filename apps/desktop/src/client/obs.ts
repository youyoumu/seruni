import { signal } from "alien-signals";
import OBSWebSocket from "obs-websocket-js";
import { config } from "#/util/config";
import { log } from "../util/logger";
import type { Status } from "./_util";

export function createObsClient() {
  class ObsClient {
    client: OBSWebSocket | undefined;
    url = () => `ws://127.0.0.1:${config.store.obs.obsWebSocketPort}`;
    reconnecting = false;
    retryCount = 0;
    maxRetries = Infinity; // keep trying forever
    maxDelay = 16000;
    retryTimer: NodeJS.Timeout | null = null;
    status: Status = "disconnected";

    async prepare() {
      await this.connect();
    }

    async connect() {
      if (this.reconnecting) return;
      this.status = "connecting";
      this.reconnecting = false;

      this.client = new OBSWebSocket();

      try {
        await this.client.connect(this.url());
        log.info(`Connected to OBS on ${this.url()}`);
        this.status = "connected";

        // Reset retry state
        this.retryCount = 0;

        // Auto-start Replay Buffer if not active
        log.info("Ensuring Replay Buffer is active...");
        const res = await this.client.call("GetReplayBufferStatus");
        if (!res.outputActive) {
          await this.client.call("StartReplayBuffer");
          log.info("Replay Buffer started");
        }

        // Listen for disconnections
        this.client.on("ConnectionClosed", () => this.handleDisconnect());
        this.client.on("ConnectionError", () => this.handleDisconnect());
      } catch (error) {
        log.error({ error }, `Failed to connect to OBS on ${this.url()}`);
        this.handleDisconnect();
      }
    }

    handleDisconnect() {
      if (this.reconnecting) return;
      this.reconnecting = true;
      this.scheduleReconnect();
    }

    scheduleReconnect() {
      if (this.retryCount >= this.maxRetries) {
        log.error("Max retries reached. Stopping OBS reconnect attempts.");
        return;
      }

      const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount); // exponential backoff
      log.info(`Reconnecting to OBS in ${delay / 1000} seconds...`);
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

  return new ObsClient();
}

export const obsClient = signal(createObsClient());
