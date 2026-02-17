import { createServerApi } from "@repo/shared/ws";
import type { ServerApi } from "@repo/shared/ws";
import type { DB } from "./db";
import type { State } from "./state/state";
import type { Logger } from "pino";

export type FullServerApi = ReturnType<typeof createServerApi>;

export interface AppContext {
  db: DB;
  state: State;
  logger: Logger;
  api: ServerApi;
  onPayload: FullServerApi["onPayload"];
  addWS: FullServerApi["addWS"];
  removeWS: FullServerApi["removeWS"];
  upgradeWebSocket: ReturnType<typeof import("@hono/node-ws")["createNodeWebSocket"]> extends { upgradeWebSocket: infer U } ? U : never;
}
