import type { TextHookerClient } from "#/client/text-hooker.client";
import type { DB } from "#/services/db.service";
import type { State } from "#/state/state";
import { textHistory, session } from "@repo/shared/db";
import { zConfig } from "@repo/shared/schema";
import type { ServerApi } from "@repo/shared/ws";
import { effect } from "alien-signals";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

export class WSSHandlers {
  constructor(
    public api: ServerApi,
    public db: DB,
    public state: State,
    public log: Logger,
    public textHookerClient: TextHookerClient,
  ) {
    this.log = log.child({ name: "wss" });
    this.setupStateEffect();
    this.setupOnRequest();

    api.onPush.action((id) => {
      state.actionMap.get(id)?.();
    });
  }

  setupOnRequest() {
    const { api, state, db } = this;

    api.onRequest.textHookerConnected(() => state.textHookerConnected());
    api.onRequest.ankiConnectConnected(() => state.ankiConnectConnected());
    api.onRequest.obsConnected(() => state.obsConnected());

    api.onRequest.isListeningTextHooker(() => state.isListeningTextHooker());
    api.onRequest.setIsListeningTextHooker(async (isListeningTextHooker) => {
      state.isListeningTextHooker(isListeningTextHooker);
      return isListeningTextHooker;
    });
    api.onRequest.isTextHookerAutoResume(() => state.isTextHookerAutoResume());
    api.onRequest.setIsTextHookerAutoResume(async (isTextHookerAutoResume) => {
      state.isTextHookerAutoResume(isTextHookerAutoResume);
      return isTextHookerAutoResume;
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
      const result = db.insert(session).values({ name }).returning().get();
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

    api.onRequest.config(() => state.config());
    api.onRequest.setConfig(async (payload) => {
      const currentConfig = state.config();
      const newConfig = zConfig.safeParse({ ...currentConfig, ...payload });
      if (newConfig.success) {
        state.config(newConfig.data);
        return state.config();
      }
      return null;
    });

    api.onRequest.checkHealth(() => undefined);

    api.onPush.refreshAfkTimer(() => {
      this.textHookerClient.setupAfkTimer();
    });
  }

  setupStateEffect() {
    const { state, db, api } = this;

    effect(async () => {
      const activeSessionId = state.activeSessionId();
      if (!activeSessionId) return;
      const result = await db.query.session.findFirst({
        where: eq(session.id, activeSessionId),
      });
      api.push.activeSession(result ?? null);
    });

    effect(() => {
      const isListeningTextHooker = state.isListeningTextHooker();
      api.push.isListeningTextHooker(isListeningTextHooker);
    });

    effect(() => {
      const isTextHookerAutoResume = state.isTextHookerAutoResume();
      api.push.isTextHookerAutoResume(isTextHookerAutoResume);
    });

    effect(() => {
      const textHookerConnected = state.textHookerConnected();
      api.push.textHookerConnected(textHookerConnected);
    });

    effect(() => {
      const ankiConnectConnected = state.ankiConnectConnected();
      api.push.ankiConnectConnected(ankiConnectConnected);
    });

    effect(() => {
      const obsConnected = state.obsConnected();
      api.push.obsConnected(obsConnected);
    });
  }
}
