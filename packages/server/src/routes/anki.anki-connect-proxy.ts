import type { AppContext } from "#/types/types";
import { anyFail, safeJSONParse } from "#/util/result";
import { zAnkiConnectAddNote, zAnkiConnectCanAddNotes } from "#/util/schema";
import { R } from "@praha/byethrow";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Logger } from "pino";
import z from "zod";

type ProxyContext = {
  bodyJson: ReturnType<typeof JSON.parse> | undefined;
  log: Logger;
  forward: (overwrite?: {
    headers?: Headers;
    body?: BodyInit | null | undefined;
  }) => Promise<{ response: Response; json: ReturnType<typeof JSON.parse> }>;
};

const app = new Hono<{ Variables: { ctx: AppContext; proxyCtx: ProxyContext } }>();

// setup first middleware
app.post("/", async (c, next) => {
  const { logger, state } = c.get("ctx");
  const log = logger.child({ name: "anki-connect-proxy" });
  const url = new URL(c.req.url);
  const targetUrl = `${state.config().ankiConnectAddress}${url.pathname}${url.search}`;
  let body: ArrayBuffer | undefined;
  let bodyText: string | undefined;
  let bodyJson: ReturnType<typeof JSON.parse> | undefined;
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    body = await c.req.arrayBuffer();
    bodyText = new TextDecoder().decode(body);
  }
  if (bodyText) {
    const result = safeJSONParse(bodyText);
    if (R.isSuccess(result)) bodyJson = result.value;
  }
  log.trace(
    { URL: targetUrl, METHOD: c.req.method, BODY: bodyJson ?? bodyText },
    "AnkiConnect proxy received a request",
  );

  const forward = async (
    overwrite: { headers?: Headers; body?: BodyInit | null | undefined } = {},
  ) => {
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers: overwrite.headers ?? c.req.raw.headers,
      body: overwrite.body ?? body,
    });
    const json = await response.clone().json();
    log.trace({ json }, "AnkiConnect proxy received response");
    return {
      response: new Response(response.body, {
        status: response.status,
        headers: response.headers,
      }),
      json,
    };
  };
  c.set("proxyCtx", { bodyJson, log, forward });
  await next();
});

// intercept canAddNotes
app.post("/", async (c, next) => {
  const { state, ankiConnectClient } = c.get("ctx");
  const { bodyJson, log, forward } = c.get("proxyCtx");
  const expressionField = state.config().ankiExpressionField;
  const { success, data } = zAnkiConnectCanAddNotes(expressionField).safeParse(bodyJson);
  if (!success) return await next();
  log.trace("AnkiConnect proxy received CanAddNotes request, tracking duplicate note");

  const deckName = data.params.notes[0]?.deckName;
  log.trace(`Detected deckName: ${deckName}`);
  if (deckName) state.yomitanAnkiConnectDeckName(deckName);
  const expressions = data.params.notes.map((item) => item.fields[expressionField]);
  if (expressions.includes(undefined)) {
    throw new HTTPException(500, { message: "Invalid expressionField" });
  }

  const { response, json } = await forward();
  const parsed = z.array(z.boolean()).parse(json);
  for (let i = 0; i < expressions.length; i++) {
    const expression = expressions[i];
    const isDuplicate = parsed[i] === false;
    if (isDuplicate && expression) ankiConnectClient.duplicateList.add(expression);
  }
  log.trace(Array.from(ankiConnectClient.duplicateList), "Updated duplicate list");

  return response;
});

// intercept addNote
app.post("/", async (c, next) => {
  const { state, ankiConnectClient } = c.get("ctx");
  const { bodyJson, log, forward } = c.get("proxyCtx");
  const expressionField = state.config().ankiExpressionField;
  const sentenceField = state.config().ankiSentenceField;
  const { success, data } = zAnkiConnectAddNote.safeParse(bodyJson);
  if (!success) return await next();

  //TODO: inject payload instead of listening
  log.debug("AnkiConnect proxy received AddNote request, processing new note");
  const expression = data.params.note.fields[expressionField];
  const sentence = data.params.note.fields[sentenceField];
  if (expression === undefined) {
    throw new HTTPException(500, { message: "Invalid expressionField" });
  }
  if (sentence === undefined) {
    throw new HTTPException(500, { message: "Invalid sentenxtField" });
  }

  // TODO: intercept duplicate note
  //
  // if (ankiClient().duplicateList.has(expression)) {
  //   const uuid = crypto.randomUUID();
  //   interceptedRequest.set(uuid, c.req);
  //
  //   const noteIds = await ankiClient().client?.note.findNotes({
  //     query: `"deck:${yomitanAnkiConnectSettings.deckName}" "expression:${expression}"`,
  //   });
  //   if (!noteIds) throw new Error("Note not found");
  //   log.debug({ noteIds }, "Found duplicate notes");
  //   miningIPC().send("mining:duplicateNoteConfirmation", { uuid, noteIds });
  //
  //   return new Response("Intercepted", {
  //     status: 500,
  //   });
  // }

  const textHistoryId = extractTextHistoryId(sentence);
  if (R.isFailure(textHistoryId))
    throw new HTTPException(500, { message: textHistoryId.error.message });
  log.debug(`Extracted textHistoryId from sentence: ${textHistoryId.value}`);
  for (const key of Object.keys(data.params.note.fields)) {
    const value = data.params.note.fields[key];
    if (!value) continue;
    data.params.note.fields[key] = stripTextHistoryId(value);
  }
  const body = JSON.stringify(data);
  const headers = new Headers(c.req.raw.headers);
  headers.set("content-length", Buffer.byteLength(body, "utf-8").toString());

  const { response, json } = await forward({ headers, body });
  const noteId_ = z.union([z.number(), z.object({ result: z.number() })]).parse(json);
  const noteId = typeof noteId_ === "number" ? noteId_ : noteId_.result;

  await ankiConnectClient.preUpdateNoteMedia({
    noteId,
    textHistoryId: textHistoryId.value,
  });

  return response;
});

// forward request
app.post("/", async (c) => {
  const { forward } = c.get("proxyCtx");
  const { response } = await forward();
  return response;
});

function extractTextHistoryId(sentence: string): R.Result<number, Error> {
  const match = sentence.match(/‹id:(\d+)›/);
  const id = Number(match?.[1]);
  if (isNaN(id)) return anyFail("Can't find textHistoryId in sentence");
  return R.succeed(id);
}

function stripTextHistoryId(sentence: string) {
  return sentence.replace(/‹id:(\d+)›/, "");
}

export { app as ankiAnkiConnectProxy };
