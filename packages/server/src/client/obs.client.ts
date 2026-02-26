import type { State } from "#/state/state";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { ReconnectingOBSWebSocket } from "./ReconnectingOBSWebSocket";

export class OBSClient extends ReconnectingOBSWebSocket {
  state: State;
  #replayBufferActive = false;

  constructor(opts: { logger: Logger; state: State }) {
    super({
      logger: opts.logger.child({ name: "obs-client" }),
      url: opts.state.config().obsWebSocketAddress,
    });
    this.state = opts.state;

    this.addListener("open", async () => {
      this.state.obsConnected(true);
      await this.#startReplayBuffer();
    });

    this.addListener("close", () => {
      this.state.obsConnected(false);
      this.#replayBufferActive = false;
    });

    this.#listenToReplayBufferEvents();
  }

  #listenToReplayBufferEvents() {
    const handler = async (event: { outputActive: boolean; outputState: string }) => {
      if (!this.#replayBufferActive && event.outputActive) {
        this.log.info("Replay buffer started");
      }
      this.#replayBufferActive = event.outputActive;
      if (event.outputState !== "OBS_WEBSOCKET_OUTPUT_STOPPED") return;
      if (!this.#isStartingReplayBuffer) {
        this.log.warn("Replay buffer stopped, restarting...");
        await this.#startReplayBuffer();
      }
    };
    this.client.on("ReplayBufferStateChanged", handler);
    return () => {
      this.client.off("ReplayBufferStateChanged", handler);
    };
  }

  #isStartingReplayBuffer = false;
  async #startReplayBuffer() {
    if (this.#isStartingReplayBuffer) return;
    this.#isStartingReplayBuffer = true;
    try {
      const status = await this.call("GetReplayBufferStatus");
      if (!status.outputActive) {
        await this.call("StartReplayBuffer");
      } else {
        this.#replayBufferActive = true;
      }
    } catch (e) {
      if (e instanceof Error) this.log.warn(`Failed to start replay buffer: ${e.message}`);
      setTimeout(() => this.#startReplayBuffer(), 5000);
    } finally {
      this.#isStartingReplayBuffer = false;
    }
  }

  get replayBufferActive() {
    return this.#replayBufferActive;
  }

  async saveReplayBuffer(): Promise<R.Result<string, Error>> {
    const { promise, resolve } = Promise.withResolvers<string>();
    const handler = (event: { savedReplayPath: string }) => {
      cleanup();
      resolve(event.savedReplayPath);
    };
    const cleanup = () => {
      this.client.off("ReplayBufferSaved", handler);
    };
    this.client.on("ReplayBufferSaved", handler);
    this.call("SaveReplayBuffer").catch((error) => {
      cleanup();
      resolve(error);
    });
    return R.succeed(await promise);
  }
}
