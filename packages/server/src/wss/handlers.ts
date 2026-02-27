import type { DB } from "#/db";
import type { State } from "#/state/state";
import { textHistory, session } from "@repo/shared/db";
import type { ServerApi } from "@repo/shared/ws";
import { effect } from "alien-signals";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

export function registerHandlers({
  api,
  db,
  state,
  logger,
}: {
  api: ServerApi;
  db: DB;
  state: State;
  logger: Logger;
}) {
  const logState = logger.child({ name: "state" });

  effect(async () => {
    const activeSessionId = state.activeSessionId();
    logState.debug(`activeSessionId: ${activeSessionId}`);
    if (!activeSessionId) return;
    const result = await db.query.session.findFirst({
      where: eq(session.id, activeSessionId),
    });
    api.push.activeSession(result ?? null);
  });

  effect(() => {
    const isListeningTexthooker = state.isListeningTexthooker();
    logState.debug(`isListeningTexthooker: ${isListeningTexthooker}`);
    api.push.isListeningTexthooker(isListeningTexthooker);
  });

  effect(() => {
    const textHookerConnected = state.textHookerConnected();
    logState.debug(`textHookerConnected: ${textHookerConnected}`);
    api.push.textHookerConnected(textHookerConnected);
  });

  effect(() => {
    const ankiConnectConnected = state.ankiConnectConnected();
    logState.debug(`ankiConnectConnected: ${ankiConnectConnected}`);
    api.push.ankiConnectConnected(ankiConnectConnected);
  });

  effect(() => {
    const obsConnected = state.obsConnected();
    logState.debug(`obsConnected: ${obsConnected}`);
    api.push.obsConnected(obsConnected);
  });

  api.onRequest.textHookerConnected(() => state.textHookerConnected());
  api.onRequest.ankiConnectConnected(() => state.ankiConnectConnected());
  api.onRequest.obsConnected(() => state.obsConnected());

  api.onRequest.isListeningTexthooker(() => state.isListeningTexthooker());
  api.onRequest.setIsListeningTexthooker(async (isListeningTexthooker) => {
    state.isListeningTexthooker(isListeningTexthooker);
    return isListeningTexthooker;
  });

  api.onRequest.textHistoryBySessionId(async (id) => {
    return await db.select().from(textHistory).where(eq(textHistory.sessionId, id));
  });

  api.onRequest.deleteTextHistory(async (id) => {
    const [result] = await db.delete(textHistory).where(eq(textHistory.id, id)).returning();
    return result ?? null;
  });

  api.onRequest.completedTextHistory(async () => {
    return state.completedTextHistory();
  });

  api.onRequest.markTextHistoryAsCompleted(async (id) => {
    const [result] = await db.select().from(textHistory).where(eq(textHistory.id, id));
    if (result) state.completedTextHistory()[result.id] = Date.now();
    return result ?? null;
  });

  api.onRequest.session(async (id) => {
    const result = await db.query.session.findFirst({
      where: eq(session.id, id),
    });
    return result ?? null;
  });

  api.onRequest.sessions(async () => {
    return await db.select().from(session);
  });

  api.onRequest.createSession(async (name) => {
    const result = await db.insert(session).values({ name }).returning().get();
    state.activeSessionId(result.id);
    return result;
  });

  api.onRequest.deleteSession(async (id) => {
    const [result] = await db.delete(session).where(eq(session.id, id)).returning();
    if (result?.id === state.activeSessionId()) state.activeSessionId(null);
    return result ?? null;
  });

  api.onRequest.setActiveSession(async (id) => {
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

  api.onRequest.getActiveSession(async () => {
    const activeSessionId = state.activeSessionId();
    if (!activeSessionId) return null;
    const result = await db.query.session.findFirst({
      where: eq(session.id, activeSessionId),
    });
    return result ?? null;
  });

  api.onRequest.updateSession(async (payload) => {
    if (!payload.id) return null;
    const [result] = await db
      .update(session)
      .set({
        ...payload,
      })
      .where(eq(session.id, payload.id))
      .returning();
    return result ?? null;
  });

  api.onRequest.checkHealth(() => undefined);
}
