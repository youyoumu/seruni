import type { AnkiConnectClient } from "#/client/anki-connect.client";
import type { State } from "#/state/state";
import type { AppContext } from "#/types/types";
import { zAnkiConnectAddNote, zAnkiConnectCanAddNotes } from "#/util/schema";
import { Hono, type HonoRequest } from "hono";
import type { Logger } from "pino";
import z from "zod";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.post("/", async (c) => {
  const { logger, state, ankiConnectClient } = c.get("ctx");
  const log = logger.child({ name: "anki-connect-proxy" });
  const url = new URL(c.req.url);
  const target = `${state.config().ankiConnectAddress}${url.pathname}${url.search}`;
  const expressionField = state.config().ankiExpressionField;

  let body: ArrayBuffer | undefined;
  let bodyText: string | undefined;
  let bodyJson: ReturnType<typeof JSON.parse> | undefined;

  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    body = await c.req.arrayBuffer();
    bodyText = new TextDecoder().decode(body);
  }

  if (bodyText) {
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {}
  }
  log.trace(
    { URL: url.toString(), METHOD: c.req.method, BODY: bodyJson ?? bodyText },
    "AnkiConnect proxy received a request",
  );

  // intercept and handle canAddNotes
  const ankiConnectCanAddNote = zAnkiConnectCanAddNotes(expressionField).safeParse(bodyJson);
  if (ankiConnectCanAddNote.success) {
    log.trace("AnkiConnect proxy received CanAddNotes request, tracking duplicate note");
    const deckName = ankiConnectCanAddNote.data.params.notes[0]?.deckName;
    log.trace({ deckName }, "Detected deckName");
    if (deckName) state.yomitanAnkiConnectDeckName(deckName);
    const expressions = ankiConnectCanAddNote.data.params.notes.map(
      (item) => item.fields[expressionField],
    );
    if (expressions.some((item) => item === undefined)) {
      throw new Error(
        "AnkiConnect request uses Expression field that is different from configured field",
      );
    }

    const res = await fetch(target, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body,
    });

    const resClone = res.clone();
    const result = await resClone.json();
    const parsed = z.array(z.boolean()).parse(result);
    for (let i = 0; i < expressions.length; i++) {
      const expression = expressions[i];
      const isDuplicate = parsed[i] === false;
      if (isDuplicate && expression) ankiConnectClient.duplicateList.add(expression);
    }

    log.trace(Array.from(ankiConnectClient.duplicateList), "Updated duplicate list");

    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    });
  }

  //TODO: inject payload instead of listening
  //intercept and handle addNote
  const ankiConnectAddNote = zAnkiConnectAddNote.safeParse(bodyJson);
  if (ankiConnectAddNote.success) {
    log.debug("AnkiConnect proxy received AddNote request, processing new note");
    const expression = ankiConnectAddNote.data.params.note.fields[expressionField];
    if (expression === undefined) throw new Error("Expression field is missing, invalid config?");
    // intercept and duplicate notes
    // TODO: duplicate intercept
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

    const res = await proxyAnkiConnectAddNoteRequest(c.req, log, state, ankiConnectClient);

    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    });
  }

  const res = await fetch(target, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body,
  });

  const resClone = res.clone();
  const result = await resClone.json();
  log.trace({ result }, "AnkiConnect proxy received response");

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
});

export const proxyAnkiConnectAddNoteRequest = async (
  req: HonoRequest,
  log: Logger,
  state: State,
  ankiConnectClient: AnkiConnectClient,
) => {
  const url = new URL(req.url);
  const target = `${state.config().ankiConnectAddress}${url.pathname}${url.search}`;
  const { textHistoryId, body } = await parseAddNoteRequest(req, log, state);

  const headers = new Headers(req.raw.headers);
  headers.set("content-length", Buffer.byteLength(body, "utf-8").toString());

  const res = await fetch(target, {
    method: req.method,
    headers,
    body,
  });
  const resClone = res.clone();
  const resJson = await resClone.json();

  const noteId_ = z.union([z.number(), z.object({ result: z.number() })]).parse(resJson);
  const noteId = typeof noteId_ === "number" ? noteId_ : noteId_.result;
  const updateResult = ankiConnectClient.preUpdateNoteMedia({
    noteId,
    textHistoryId,
  });
  if (updateResult instanceof Error) {
    log.error(updateResult.message);
  }

  return res;
};

function extractTextHistoryId(sentence: string) {
  const match = sentence.match(/‹id:([0-9a-f-]{36})›/);
  const id = Number(match?.[1]);
  if (isNaN(id)) return new Error("ID not found");
  return id;
}

function stripUuid(sentence: string) {
  return sentence.replace(/‹id:[0-9a-f-]{36}›/, "");
}

export async function parseAddNoteRequest(req: HonoRequest, log: Logger, state: State) {
  const body = await req.arrayBuffer();
  const bodyText = new TextDecoder().decode(body);
  const bodyJson = JSON.parse(bodyText);

  const sentenceField = state.config().ankiSentenceField;

  const ankiConnectAddNote = zAnkiConnectAddNote.parse(bodyJson);
  const sentence = ankiConnectAddNote.params.note.fields[sentenceField];
  if (sentence === undefined) throw new Error("Sentence field is missing, invalid config?");
  const textHistoryId = extractTextHistoryId(sentence);
  if (textHistoryId instanceof Error) throw textHistoryId;
  log.trace(`Extracted ID from sentence: ${textHistoryId}`);

  for (const key of Object.keys(ankiConnectAddNote.params.note.fields)) {
    const value = ankiConnectAddNote.params.note.fields[key];
    if (!value) continue;
    const strippedValue = stripUuid(value);
    ankiConnectAddNote.params.note.fields[key] = strippedValue;
  }
  const newBody = JSON.stringify(ankiConnectAddNote);

  return { textHistoryId, body: newBody };
}

export { app as ankiAnkiConnectProxyRoute };
