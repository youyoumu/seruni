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

    api.onPush["action/dispatch"]((c) => {
      state.actionMap.get(c.push.body)?.();
    });
  }

  setupOnRequest() {
    const { api, state, db } = this;

    api.onRequest["text-hooker/connected/get"](() => state.textHookerConnected());
    api.onRequest["anki-connect/connected/get"](() => state.ankiConnectConnected());
    api.onRequest["obs/connected/get"](() => state.obsConnected());

    api.onRequest["text-hooker/listening/get"](() => state.isListeningTextHooker());
    api.onRequest["text-hooker/listening/set"](async (c) => {
      const isListeningTextHooker = c.req.body;
      state.isListeningTextHooker(isListeningTextHooker);
      return isListeningTextHooker;
    });
    api.onRequest["text-hooker/auto-resume/get"](() => state.isTextHookerAutoResume());
    api.onRequest["text-hooker/auto-resume/set"](async (c) => {
      const isTextHookerAutoResume = c.req.body;
      state.isTextHookerAutoResume(isTextHookerAutoResume);
      return isTextHookerAutoResume;
    });

    api.onRequest["text-history/by-session/get"](async (c) => {
      const id = c.req.body;
      return await db.select().from(textHistory).where(eq(textHistory.sessionId, id));
    });

    api.onRequest["text-history/delete"](async (c) => {
      const id = c.req.body;
      const [result] = await db.delete(textHistory).where(eq(textHistory.id, id)).returning();
      return result ?? null;
    });

    api.onRequest["text-history/completed/get"](async () => {
      return state.completedTextHistory();
    });

    api.onRequest["text-history/completed/set"](async (c) => {
      const id = c.req.body;
      const [result] = await db.select().from(textHistory).where(eq(textHistory.id, id));
      if (!result) throw "INVALID_ID";
      state.completedTextHistory()[result.id] = Date.now();
      return result;
    });

    api.onRequest["session/get"](async (c) => {
      const id = c.req.body;
      const result = await db.query.session.findFirst({
        where: eq(session.id, id),
      });
      if (!result) throw "INVALID_ID";
      return result;
    });

    api.onRequest["session/list"](async () => {
      return await db.select().from(session);
    });

    api.onRequest["session/create"](async (c) => {
      const name = c.req.body;
      const result = db.insert(session).values({ name }).returning().get();
      state.activeSessionId(result.id);
      return result;
    });

    api.onRequest["session/delete"](async (c) => {
      const id = c.req.body;
      const [result] = await db.delete(session).where(eq(session.id, id)).returning();
      if (!result) throw "INVALID_ID";
      if (result?.id === state.activeSessionId()) state.activeSessionId(null);
      return result;
    });

    api.onRequest["session/active/set"](async (c) => {
      const id = c.req.body;
      const result = await db.query.session.findFirst({
        where: eq(session.id, id),
      });
      if (!result) throw "INVALID_ID";
      state.activeSessionId(result.id);
      return result;
    });

    api.onRequest["session/active/get"](async () => {
      const activeSessionId = state.activeSessionId();
      if (!activeSessionId) return null;
      const result = await db.query.session.findFirst({
        where: eq(session.id, activeSessionId),
      });
      return result ?? null;
    });

    api.onRequest["session/update"](async (c) => {
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

    api.onRequest["config/get"](() => state.config());
    api.onRequest["config/set"](async (c) => {
      const payload = c.req.body;
      const currentConfig = state.config();
      const newConfig = zConfig.safeParse({ ...currentConfig, ...payload });
      if (!newConfig.success) throw "INVALID_CONFIG";
      state.config(newConfig.data);
      return state.config();
    });

    api.onRequest["health/check"](() => undefined);

    api.onPush["timer/afk/refresh"](() => {
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
      api.push["session/active/set"](result ?? null);
    });

    effect(() => {
      const isListeningTextHooker = state.isListeningTextHooker();
      api.push["text-hooker/listening/set"](isListeningTextHooker);
    });

    effect(() => {
      const isTextHookerAutoResume = state.isTextHookerAutoResume();
      api.push["text-hooker/auto-resume/set"](isTextHookerAutoResume);
    });

    effect(() => {
      const textHookerConnected = state.textHookerConnected();
      api.push["text-hooker/connected/set"](textHookerConnected);
    });

    effect(() => {
      const ankiConnectConnected = state.ankiConnectConnected();
      api.push["anki-connect/connected/set"](ankiConnectConnected);
    });

    effect(() => {
      const obsConnected = state.obsConnected();
      api.push["obs/connected/set"](obsConnected);
    });
  }
}
