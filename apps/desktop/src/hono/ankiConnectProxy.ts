import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import z from "zod";
import { env } from "#/env";
import { bus } from "#/util/bus";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { zAnkiConnectAddNote } from "#/util/schema";

const app = new Hono();

app.use("*", cors());

app.all("*", async (c) => {
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

  //TODO: inject payload instead of listening
  const ankiConnectAddNote = zAnkiConnectAddNote.safeParse(bodyJson);
  if (ankiConnectAddNote.success) {
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

export function startAnkiConnectProxtServer() {
  log.info(
    `Starting AnkiConnect proxy server on port ${env.ANKI_CONNECT_PROXY_PORT}`,
  );
  serve({
    fetch: app.fetch,
    port: env.ANKI_CONNECT_PROXY_PORT,
  });
}
