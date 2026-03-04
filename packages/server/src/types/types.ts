import type { AnkiConnectClient } from "#/client/anki-connect.client";
import type { DB } from "#/services/db.service";
import type { State } from "#/state/state";
import { createServerApi } from "@repo/shared/ws";
import type { ServerApi } from "@repo/shared/ws";
import type { UpgradeWebSocket } from "hono/ws";
import type { Logger } from "pino";

export interface AppContext {
  db: DB;
  state: State;
  log: Logger;
  api: ServerApi;
  onMessage: ReturnType<typeof createServerApi>["onMessage"];
  addWS: ReturnType<typeof createServerApi>["addWS"];
  removeWS: ReturnType<typeof createServerApi>["removeWS"];
  upgradeWebSocket: UpgradeWebSocket;
  ankiConnectClient: AnkiConnectClient;
}
