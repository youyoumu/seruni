import type { Logger } from "pino";

import { ReconnectingAnkiConnect } from "./ReconnectingAnkiConnect";

export class AnkiConnectClient extends ReconnectingAnkiConnect {
  constructor(options: { logger: Logger }) {
    super({
      yankiConnectOptions: {
        key: undefined,
        host: "http://127.0.0.1",
        port: 8765,
        version: 6,
      },
      logger: options.logger.child({ name: "anki-connect-client" }),
    });
  }
}
