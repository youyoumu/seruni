import type { State } from "#/state/state";
import type { AppContext } from "#/types/types";
import { zAnkiConnectAddNote, zAnkiConnectCanAddNotes } from "#/util/schema";
import { Hono, type HonoRequest } from "hono";
import z from "zod";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.post("/", async (c) => {
  const { logger, state } = c.get("ctx");
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
    //TODO:
    // if (deckName) yomitanAnkiConnectSettings.deckName = deckName;
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
      //TODO: duplicate list
      // if (isDuplicate && expression) ankiClient().duplicateList.add(expression);
    }

    // log.trace({ duplicateList: Array.from(ankiClient().duplicateList) }, "Updated duplicate list");

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

    const res = await proxyAnkiConnectAddNoteRequest(c.req, log, state);

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
  log: {
    error: (log: string) => void;
    trace: (log: string) => void;
  },
  state: State,
) => {
  const url = new URL(req.url);
  const target = `${state.config().ankiConnectAddress}${url.pathname}${url.search}`;

  const { id, body } = await parseAddNoteRequest(req, log, state);
  console.log("DEBUG[854]: body=", body);

  const headers = new Headers(req.raw.headers);
  headers.set("content-length", Buffer.byteLength(body, "utf-8").toString());

  const res = await fetch(target, {
    method: req.method,
    headers,
    body,
  });
  const resClone = res.clone();
  const resJson = await resClone.json();
  console.log("DEBUG[853]: resJson=", resJson);
  try {
    const noteId = z.union([z.number(), z.object({ result: z.number() })]).parse(resJson);
    //TODO:
    // if (typeof noteId === "number") {
    //   bus.emit("anki:handleUpdateNoteMedia", {
    //     noteId: noteId,
    //     selectedTextUuid: uuid,
    //   });
    // } else if (typeof noteId === "object") {
    //   bus.emit("anki:handleUpdateNoteMedia", {
    //     noteId: noteId.result,
    //     selectedTextUuid: uuid,
    //   });
    // } else {
    //   throw new Error("Invalid response from AnkiConnect");
    // }
  } catch (e) {
    //TODO: sent error toast
    log.error(e instanceof Error ? e.message : "Unknown Error");
  }

  return res;
};

function extractId(sentence: string) {
  const match = sentence.match(/‹id:([0-9a-f-]{36})›/);
  return match?.[1] ?? null;
}

function stripUuid(sentence: string) {
  return sentence.replace(/‹id:[0-9a-f-]{36}›/, "");
}

export async function parseAddNoteRequest(
  req: HonoRequest,
  log: {
    trace: (log: string) => void;
  },
  state: State,
) {
  const body = await req.arrayBuffer();
  const bodyText = new TextDecoder().decode(body);
  const bodyJson = JSON.parse(bodyText);

  const sentenceField = state.config().ankiSentenceField;

  const ankiConnectAddNote = zAnkiConnectAddNote.parse(bodyJson);
  const sentence = ankiConnectAddNote.params.note.fields[sentenceField];
  if (sentence === undefined) throw new Error("Sentence field is missing, invalid config?");
  const id = extractId(sentence);
  if (id === null) throw new Error("ID not found");
  log.trace(`Extracted ID from sentence: ${id}`);

  for (const key of Object.keys(ankiConnectAddNote.params.note.fields)) {
    const value = ankiConnectAddNote.params.note.fields[key];
    if (!value) continue;
    const strippedValue = stripUuid(value);
    ankiConnectAddNote.params.note.fields[key] = strippedValue;
  }
  const newBody = JSON.stringify(ankiConnectAddNote);

  return { id, body: newBody };
}

export { app as ankiAnkiConnectProxyRoute };
