import type { State } from "#/state/state";
import type { Logger } from "pino";

import { ReconnectingAnkiConnect } from "./ReconnectingAnkiConnect";

export class AnkiConnectClient extends ReconnectingAnkiConnect {
  state: State;

  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      host: "http://127.0.0.1",
      port: 8765,
      logger: logger.child({ name: "anki-connect-client" }),
    });
    this.state = state;

    this.addListener("open", () => {
      this.state.ankiConnectConnected(true);
    });

    this.addListener("close", () => {
      this.state.ankiConnectConnected(false);
    });
  }
}
