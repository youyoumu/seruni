import { Hono } from "hono";
import z from "zod";
import { ankiClient } from "#/client/clientAnki";
import { bus } from "#/util/bus";
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
    {
      URL: url.toString(),
      METHOD: c.req.method,
      BODY: bodyJson ?? bodyText,
    },
    "AnkiConnect proxy received a request",
  );

  const res = await fetch(target, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body,
  });

  const ankiConnectCanAddNote = zAnkiConnectCanAddNotes().safeParse(bodyJson);
  if (ankiConnectCanAddNote.success) {
    log.trace(
      "AnkiConnect proxy received CanAddNotes request, tracking duplicate note",
    );
    const expressions = ankiConnectCanAddNote.data.params.notes.map(
      (item) => item.fields[config.store.anki.expressionField],
    );
    if (expressions.some((item) => item === undefined)) {
      throw new Error(
        "AnkiConnect request uses Expression field that is different from configured field",
      );
    }

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
  }

  //TODO: inject payload instead of listening
  const ankiConnectAddNote = zAnkiConnectAddNote.safeParse(bodyJson);
  if (ankiConnectAddNote.success) {
    log.debug(
      "AnkiConnect proxy received AddNote request, processing new note",
    );
    const resClone = res.clone();
    try {
      const noteId = z
        .union([z.number(), z.object({ result: z.number() })])
        .parse(await resClone.json());
      if (typeof noteId === "number") {
        bus.emit("anki:handleNewNote", {
          noteId: noteId,
        });
      } else if (typeof noteId === "object") {
        bus.emit("anki:handleNewNote", {
          noteId: noteId.result,
        });
      } else {
        throw new Error("Invalid response from AnkiConnect");
      }
    } catch (e) {
      log.error({ error: e }, e instanceof Error ? e.message : "Unknown Error");
    }
  }

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
});

export { app };
