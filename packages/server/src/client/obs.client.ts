import type { Logger } from "pino";

import { ReconnectingOBSWebSocket } from "./ReconnectingOBSWebSocket";

export class OBSClient extends ReconnectingOBSWebSocket {
  constructor({ logger }: { logger: Logger }) {
    super({
      logger: logger.child({ name: "obs-client" }),
      url: "ws://127.0.0.1:4455",
    });
  }
}
