import type { DB } from "#/db";
import type { State } from "#/state/state";
import { textHistory, session } from "@repo/shared/db";
import type { ServerApi } from "@repo/shared/ws";
import { eq } from "drizzle-orm";

export function registerHandlers({ api, db, state }: { api: ServerApi; db: DB; state: State }) {
  api.handleRequest.textHistoryBySessionId(async (id) => {
    return await db.select().from(textHistory).where(eq(textHistory.sessionId, id));
  });

  api.handleRequest.session(async (id) => {
    return (
      (await db.query.session.findFirst({
        where: eq(session.id, id),
      })) ?? null
    );
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
    if (result?.id === state.activeSessionId()) state.activeSessionId(null);
    return result ?? null;
  });

  api.handleRequest.setActiveSession(async (id) => {
    const result = await db.query.session.findFirst({
      where: eq(session.id, id),
    });
    if (result) {
      state.activeSessionId(result.id);
    } else {
      state.activeSessionId(null);
    }
    return result ?? null;
  });

  api.handleRequest.getActiveSession(async () => {
    const activeSessionId = state.activeSessionId();
    if (!activeSessionId) return null;
    return (
      (await db.query.session.findFirst({
        where: eq(session.id, activeSessionId),
      })) ?? null
    );
  });

  api.handleRequest.checkHealth(() => undefined);
}
