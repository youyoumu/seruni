import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import mime from "mime";
import { ankiClient } from "#/client/anki";
import { env } from "#/env";
import { log } from "#/util/logger";

hmr.log(import.meta.url);
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
  if (!mediaDir) {
    return c.notFound();
  }
  const filePath = join(mediaDir, filename);

  try {
    const stat_ = await stat(filePath);
    const range = c.req.header("range");
    const mimeType = mime.getType(filePath) ?? "application/octet-stream";

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr ?? "", 10);
      const end = endStr ? parseInt(endStr, 10) : stat_.size - 1;
      const chunkSize = end - start + 1;
      const file = await readFile(filePath);

      return new Response(file.subarray(start, end + 1), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat_.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": mimeType,
        },
      });
    }

    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Content-Length": stat_.size.toString(),
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
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
