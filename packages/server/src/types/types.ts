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
  onOpen: ReturnType<typeof createServerApi>["onOpen"];
  onClose: ReturnType<typeof createServerApi>["onClose"];
  upgradeWebSocket: UpgradeWebSocket;
  ankiConnectClient: AnkiConnectClient;
}
