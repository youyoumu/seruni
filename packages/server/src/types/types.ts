import type { DB } from "#/db";
import type { State } from "#/state/state";
import { createServerApi } from "@repo/shared/ws";
import type { ServerApi } from "@repo/shared/ws";
import type { UpgradeWebSocket } from "hono/ws";
import type { Logger } from "pino";

export interface AppContext {
  db: DB;
  state: State;
  logger: Logger;
  api: ServerApi;
  onPayload: ReturnType<typeof createServerApi>["onPayload"];
  addWS: ReturnType<typeof createServerApi>["addWS"];
  removeWS: ReturnType<typeof createServerApi>["removeWS"];
  upgradeWebSocket: UpgradeWebSocket;
}
