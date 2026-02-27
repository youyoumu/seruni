import type { State } from "#/state/state";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { ReconnectingOBSWebSocket } from "./ReconnectingOBSWebSocket";

export class OBSClient extends ReconnectingOBSWebSocket {
  #replayBufferActive = false;

  constructor(
    public logger: Logger,
    public state: State,
  ) {
    super({
      logger: logger.child({ name: "obs-client" }),
      url: state.config().obsWebSocketAddress,
    });

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
    await R.pipe(
      this.call("GetReplayBufferStatus"),
      R.andThen((status) => {
        if (!status.outputActive) {
          return this.call("StartReplayBuffer");
        }
        this.#replayBufferActive = true;
        return R.succeed();
      }),
      R.inspectError((e) => {
        this.log.warn(`Failed to start replay buffer: ${e.message}`);
        setTimeout(() => this.#startReplayBuffer(), 5000);
      }),
    );
    this.#isStartingReplayBuffer = false;
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
    const cleanup = () => this.client.off("ReplayBufferSaved", handler);
    this.client.on("ReplayBufferSaved", handler);

    return await R.pipe(
      this.call("SaveReplayBuffer"),
      R.andThen(() => R.succeed(promise)),
      R.inspectError(cleanup),
    );
  }
}
