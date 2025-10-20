import type { ClientStatus } from "@repo/preload/ipc";
import { signal } from "alien-signals";
import OBSWebSocket from "obs-websocket-js";
import { ffmpeg } from "#/runner/ffmpeg";
import { config } from "#/util/config";
import { log } from "../util/logger";

class ObsClient {
  client: OBSWebSocket | undefined;
  url = () => `ws://localhost:${config.store.obs.obsWebSocketPort}`;
  reconnecting = false;
  retryCount = 0;
  retryTimer: NodeJS.Timeout | null = null;

  restartingReplayBuffer = false;
  replayBufferRetryCount = 0;
  replayBufferRetryTimer: NodeJS.Timeout | null = null;

  status: ClientStatus = "disconnected";
  replayBufferStartTime = signal<Date | undefined>(undefined);
  replayBufferDuration = signal(60000);
  replayBufferMonitorIntervalId: NodeJS.Timeout | undefined;

  #abortController = new AbortController();

  unMonitorReplayBufferDuration() {
    if (this.replayBufferMonitorIntervalId)
      clearInterval(this.replayBufferMonitorIntervalId);
  }

  monitorReplayBufferDuration() {
    this.unMonitorReplayBufferDuration();
    this.replayBufferMonitorIntervalId = setInterval(async () => {
      await this.updateReplayBufferDuration();
    }, 60000);
    this.#abortController.signal.addEventListener("abort", () => {
      this.unMonitorReplayBufferDuration();
      this.replayBufferMonitorIntervalId = undefined;
    });
  }

  unregister() {
    log.trace("OBS: Aborting AbortController");
    this.#abortController.abort();
  }

  async connect() {
    if (this.reconnecting) return;
    this.status = "connecting";
    this.client?.removeAllListeners();
    this.client = new OBSWebSocket();

    try {
      await this.client.connect(this.url());
      log.info(`OBS: Connected on ${this.url()}`);
      this.status = "connected";
      this.retryCount = 0;
      this.replayBufferRetryCount = 0;

      // Auto-start Replay Buffer if not active
      log.info("OBS: Ensuring Replay Buffer is active");
      this.startReplayBuffer();

      // listen for replay buffer state changes
      this.client.on("ReplayBufferStateChanged", async ({ outputState }) => {
        if (!this.client) throw new Error("OBS client not connected");
        if (outputState !== "OBS_WEBSOCKET_OUTPUT_STOPPED") return;
        this.unMonitorReplayBufferDuration();
        log.warn("OBS: Replay Buffer stopped, starting again");
        this.replayBufferStartTime(undefined);
        this.restartReplayBuffer();
      });

      // Listen for disconnections
      this.client.on("ConnectionError", () => {
        log.error("OBS: Connection error");
        this.unMonitorReplayBufferDuration();
        this.reconnect();
      });
      this.client.on("ConnectionClosed", () => {
        if (!this.reconnecting) {
          log.error("OBS: Connection closed");
        }
        this.unMonitorReplayBufferDuration();
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
    const delay = Math.min(16000, 1000 * 2 ** this.retryCount); // exponential backoff
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
    if (this.replayBufferRetryTimer) clearTimeout(this.replayBufferRetryTimer);
    if (this.client) {
      this.client.disconnect().catch(() => {});
      this.client = undefined;
    }
    this.reconnecting = false;
    this.restartingReplayBuffer = false;
    this.status = "disconnected";
  }

  async startReplayBuffer() {
    if (this.restartingReplayBuffer) return;
    try {
      if (!this.client) throw new Error("OBS client not connected");
      const res = await this.client.call("GetReplayBufferStatus");
      if (res.outputActive) {
        log.info("OBS: Replay Buffer already active");
      } else {
        await this.client.call("StartReplayBuffer");
        log.info("OBS: Replay Buffer started");
      }
      this.replayBufferRetryCount = 0;
      this.replayBufferStartTime(new Date());
      this.monitorReplayBufferDuration();
    } catch {
      log.warn("OBS: Failed to start Replay Buffer");
      this.restartReplayBuffer();
    }
  }

  async restartReplayBuffer() {
    if (this.restartingReplayBuffer) return;
    this.restartingReplayBuffer = true;
    const delay = Math.min(16000, 1000 * 2 ** this.replayBufferRetryCount);
    log.info(`OBS: Restarting Replay Buffer in ${delay / 1000} seconds...`);
    this.replayBufferRetryCount++;

    if (this.replayBufferRetryTimer) clearTimeout(this.replayBufferRetryTimer);
    this.replayBufferRetryTimer = setTimeout(() => {
      this.restartingReplayBuffer = false;
      this.startReplayBuffer();
    }, delay);
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

  useCache = false;
  lastReplayBufferDuration = 0;
  async updateReplayBufferDuration() {
    if (this.useCache) {
      this.replayBufferDuration(this.lastReplayBufferDuration);
      return;
    }
    const replayBufferFilePath = await this.saveReplayBuffer();
    const duration = await ffmpeg().getFileDuration(replayBufferFilePath);

    const delta = Math.abs(duration - this.lastReplayBufferDuration);
    if (delta < 5000) {
      log.debug(
        `Replay buffer duration don't changes much since last time, assumming ${this.lastReplayBufferDuration / 1000}s`,
      );
      this.replayBufferDuration(this.lastReplayBufferDuration);
      this.useCache = true;
      return;
    }

    this.lastReplayBufferDuration = duration;
    this.replayBufferDuration(duration);
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
    obsClient().unregister();
    obsClient().close();
  });
}
