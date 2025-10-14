import { env } from "#/env";
import { AppWebsocket } from "#/websocket/base";
import { devWS } from "#/websocket/dev";
import { log } from "./logger";

export async function registerAllWS() {
  AppWebsocket().io.listen(env.WS_PORT);
  log.info(`Websocket server listening on port ${env.WS_PORT}`);
  devWS().register();
}
