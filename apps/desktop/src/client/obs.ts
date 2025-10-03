import { signal } from "alien-signals";
import OBSWebSocket from "obs-websocket-js";
import { log } from "../util/logger";

export function createObsClient() {
  class ObsClient {
    client: OBSWebSocket | undefined;
    constructor() {}

    async prepare() {
      try {
        this.client = new OBSWebSocket();
        //TODO: configure port
        await this.client.connect("ws://127.0.0.1:7274");
        log.info("Connected to OBS");
        log.info("Starting Replay Buffer");
        const res = await this.client?.call("GetReplayBufferStatus");
        if (!res?.outputActive) {
          this.client?.call("StartReplayBuffer");
        }
      } catch (e) {
        log.error({ error: e }, "Failed to connect to OBS");
      }
    }
  }

  return new ObsClient();
}

export const obsClient = signal(createObsClient());
