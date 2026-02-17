import type { State } from "#/state/state";
import type { Logger } from "pino";

import { ReconnectingOBSWebSocket } from "./ReconnectingOBSWebSocket";

export class OBSClient extends ReconnectingOBSWebSocket {
  state: State;

  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      logger: logger.child({ name: "obs-client" }),
      url: "ws://127.0.0.1:4455",
    });
    this.state = state;

    this.addListener("open", () => {
      this.state.obsConnected(true);
    });

    this.addListener("close", () => {
      this.state.obsConnected(false);
    });
  }
}
