import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";

import { createNodeWebSocket } from "@hono/node-ws";
import { createServerApi } from "@repo/shared/ws";
import type {} from "@repo/shared/types";
import { createDb } from "./db";
import { session, textHistory } from "@repo/shared/db";
import { eq } from "drizzle-orm";
import { createState } from "./state/state";

async function main() {
  const logger = createLogger();
  const { api, addWS, removeWS, onPayload } = createServerApi();
  const db = createDb();
  const state = createState();

  const sessions = await db.select().from(session);
  let lastSession = sessions[sessions.length - 1];
  if (!lastSession) {
    lastSession = await db
      .insert(session)
      .values({
        name: "Default Session",
      })
      .returning()
      .get();
  }
  state.activeSessionId(lastSession.id);

  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get("/", (c) => {
    return c.text("Hello Hono!");
  });

  const log = logger.child({ name: "client" });

  api.handleRequest.textHistoryBySessionId(async (id) => {
    return await db.select().from(textHistory).where(eq(textHistory.sessionId, id));
  });

  api.handleRequest.session(async (id) => {
    return await db.query.session.findFirst({
      where: eq(session.id, id),
    });
  });

  api.handleRequest.sessions(async () => {
    return await db.select().from(session);
  });

  api.handleRequest.createSession(async (name) => {
    const result = await db.insert(session).values({ name }).returning().get();
    state.activeSessionId(result.id);
    return result;
  });

  api.handleRequest.deleteSession(async (id) => {
    const [result] = await db.delete(session).where(eq(session.id, id)).returning();
    if (result?.id === state.activeSessionId()) state.activeSessionId(undefined);
    return result;
  });

  api.handleRequest.setActiveSession(async (id) => {
    state.activeSessionId(id);
    return await db.query.session.findFirst({
      where: eq(session.id, id),
    });
  });

  api.handleRequest.getActiveSession(async () => {
    const activeSessionId = state.activeSessionId();
    if (!activeSessionId) return undefined;
    return await db.query.session.findFirst({
      where: eq(session.id, activeSessionId),
    });
  });

  api.handleRequest.checkHealth(() => undefined);

  app.get(
    "/ws",
    upgradeWebSocket(() => {
      return {
        onMessage(e, ws) {
          const payload = JSON.parse(e.data.toString());
          onPayload(payload, ws);
        },
        onOpen: (_, ws) => {
          log.info("Connection opened");
          addWS(ws);
        },
        onClose: (_, ws) => {
          log.warn("Connection closed");
          removeWS(ws);
        },
      };
    }),
  );

  const server = serve(
    {
      fetch: app.fetch,
      port: 45626,
    },
    (info) => {
      logger.info(`Server is running on http://localhost:${info.port}`);
    },
  );
  injectWebSocket(server);

  new TextHookerClient({ logger, api, db, state });
}

main();
