import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import mime from "mime";
import { ankiClient } from "#/client";
import { env } from "#/env";
import { log } from "#/util/logger";

const app = new Hono();

function waitForAnkiMediaDir() {
  return new Promise<string | undefined>((resolve) => {
    const interval = setInterval(() => {
      const mediaDir = ankiClient().mediaDir;
      if (mediaDir) {
        clearInterval(interval);
        resolve(mediaDir);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      resolve(undefined);
    }, 10000);
  });
}

app.get("/media/:filename", async (c) => {
  const filename = c.req.param("filename");
  const mediaDir = await waitForAnkiMediaDir();
  console.log("DEBUG[707]: mediaDir=", mediaDir);
  if (!mediaDir) {
    return c.notFound();
  }
  const filePath = join(mediaDir, filename);

  try {
    const buf = await readFile(filePath);
    return new Response(buf, {
      headers: {
        "Content-Type": mime.getType(filePath) || "application/octet-stream",
      },
    });
  } catch (e) {
    console.log("DEBUG[708]: e=", e);
    return c.notFound();
  }
});

//TODO: use sigle hono server instead
export function serveAnkiMedia() {
  log(`Starting HTTP server on port ${env.ANKI_MEDIA_PORT}`);
  serve({
    fetch: app.fetch,
    port: env.ANKI_MEDIA_PORT,
  });
}
