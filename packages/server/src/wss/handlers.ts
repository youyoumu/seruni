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

    api.onPush.action((c) => {
      state.actionMap.get(c.req.body)?.();
    });
  }

  setupOnRequest() {
    const { api, state, db } = this;

    api.onRequest.textHookerConnected(() => state.textHookerConnected());
    api.onRequest.ankiConnectConnected(() => state.ankiConnectConnected());
    api.onRequest.obsConnected(() => state.obsConnected());

    api.onRequest.isListeningTextHooker(() => state.isListeningTextHooker());
    api.onRequest.setIsListeningTextHooker(async (c) => {
      const isListeningTextHooker = c.req.body;
      state.isListeningTextHooker(isListeningTextHooker);
      return isListeningTextHooker;
    });
    api.onRequest.isTextHookerAutoResume(() => state.isTextHookerAutoResume());
    api.onRequest.setIsTextHookerAutoResume(async (c) => {
      const isTextHookerAutoResume = c.req.body;
      state.isTextHookerAutoResume(isTextHookerAutoResume);
      return isTextHookerAutoResume;
    });

    api.onRequest.textHistoryBySessionId(async (c) => {
      const id = c.req.body;
      return await db.select().from(textHistory).where(eq(textHistory.sessionId, id));
    });

    api.onRequest.deleteTextHistory(async (c) => {
      const id = c.req.body;
      const [result] = await db.delete(textHistory).where(eq(textHistory.id, id)).returning();
      return result ?? null;
    });

    api.onRequest.completedTextHistory(async () => {
      return state.completedTextHistory();
    });

    api.onRequest.markTextHistoryAsCompleted(async (c) => {
      const id = c.req.body;
      const [result] = await db.select().from(textHistory).where(eq(textHistory.id, id));
      if (!result) throw "INVALID_ID";
      state.completedTextHistory()[result.id] = Date.now();
      return result;
    });

    api.onRequest.session(async (c) => {
      const id = c.req.body;
      const result = await db.query.session.findFirst({
        where: eq(session.id, id),
      });
      if (!result) throw "INVALID_ID";
      return result;
    });

    api.onRequest.sessions(async () => {
      return await db.select().from(session);
    });

    api.onRequest.createSession(async (c) => {
      const name = c.req.body;
      const result = db.insert(session).values({ name }).returning().get();
      state.activeSessionId(result.id);
      return result;
    });

    api.onRequest.deleteSession(async (c) => {
      const id = c.req.body;
      const [result] = await db.delete(session).where(eq(session.id, id)).returning();
      if (!result) throw "INVALID_ID";
      if (result?.id === state.activeSessionId()) state.activeSessionId(null);
      return result;
    });

    api.onRequest.setActiveSession(async (c) => {
      const id = c.req.body;
      const result = await db.query.session.findFirst({
        where: eq(session.id, id),
      });
      if (!result) throw "INVALID_ID";
      state.activeSessionId(result.id);
      return result;
    });

    api.onRequest.getActiveSession(async () => {
      const activeSessionId = state.activeSessionId();
      if (!activeSessionId) return null;
      const result = await db.query.session.findFirst({
        where: eq(session.id, activeSessionId),
      });
      return result ?? null;
    });

    api.onRequest.updateSession(async (c) => {
      const payload = c.req.body;
      const [result] = await db
        .update(session)
        .set({
          ...payload,
        })
        .where(eq(session.id, payload.id ?? 0))
        .returning();
      if (!result) throw "INVALID_ID";
      return result;
    });

    api.onRequest.config(() => state.config());
    api.onRequest.setConfig(async (c) => {
      const payload = c.req.body;
      const currentConfig = state.config();
      const newConfig = zConfig.safeParse({ ...currentConfig, ...payload });
      if (!newConfig.success) throw "INVALID_CONFIG";
      state.config(newConfig.data);
      return state.config();
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
