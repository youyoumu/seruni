import { Hono } from "hono";
import type { JsonObject } from "roarr/dist/types";
import z from "zod";
import { ankiClient } from "#/client/clientAnki";
import {
  interceptedRequest,
  proxyAnkiConnectAddNoteRequest,
  yomitanAnkiConnectSettings,
} from "#/hono/_util";
import { miningIPC } from "#/ipc/ipcMining";
import { config } from "#/util/config";
import { logWithNamespace } from "#/util/logger";
import { zAnkiConnectAddNote, zAnkiConnectCanAddNotes } from "#/util/schema";

const log = logWithNamespace("HTTP");
const app = new Hono();

app.post("/", async (c) => {
  const url = new URL(c.req.url);
  const target = `http://localhost:${config.store.anki.ankiConnectPort}${url.pathname}${url.search}`;

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
  const ankiConnectCanAddNote = zAnkiConnectCanAddNotes().safeParse(bodyJson);
  if (ankiConnectCanAddNote.success) {
    log.trace(
      "AnkiConnect proxy received CanAddNotes request, tracking duplicate note",
    );
    const deckName = ankiConnectCanAddNote.data.params.notes[0]?.deckName;
    log.trace({ deckName }, "Detected deckName");
    if (deckName) yomitanAnkiConnectSettings.deckName = deckName;
    const expressions = ankiConnectCanAddNote.data.params.notes.map(
      (item) => item.fields[config.store.anki.expressionField],
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
      if (isDuplicate && expression) ankiClient().duplicateList.add(expression);
    }

    log.trace(
      { duplicateList: Array.from(ankiClient().duplicateList) },
      "Updated duplicate list",
    );

    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    });
  }

  //TODO: inject payload instead of listening
  //intercept and handle addNote
  const ankiConnectAddNote = zAnkiConnectAddNote.safeParse(bodyJson);
  if (ankiConnectAddNote.success) {
    log.debug(
      "AnkiConnect proxy received AddNote request, processing new note",
    );
    const expression =
      ankiConnectAddNote.data.params.note.fields[
        config.store.anki.expressionField
      ];
    if (expression === undefined)
      throw new Error("Expression field is missing, invalid config?");
    // intercept and duplicate notes
    if (ankiClient().duplicateList.has(expression)) {
      const uuid = crypto.randomUUID();
      interceptedRequest.set(uuid, c.req);

      const noteIds = await ankiClient().client?.note.findNotes({
        query: `"deck:${yomitanAnkiConnectSettings.deckName}" "expression:${expression}"`,
      });
      if (!noteIds) throw new Error("Note not found");
      log.debug({ noteIds }, "Found duplicate notes");
      miningIPC().send("mining:duplicateNoteConfirmation", { uuid, noteIds });

      return new Response("Intercepted", {
        status: 500,
      });
    }

    const res = await proxyAnkiConnectAddNoteRequest(c.req);

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
  log.trace(
    { result: result as JsonObject },
    "AnkiConnect proxy received response",
  );

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
});

export { app };
