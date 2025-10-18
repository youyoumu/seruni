import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { zAnkiCollectionMediaUrlPath } from "@repo/preload/ipc";
import { type Context, Hono } from "hono";
import mime from "mime";
import { ankiClient } from "#/client/anki";
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

async function handleMediaRequest(
  c: Context,
  { filePath }: { filePath: string },
) {
  try {
    const stats = await stat(filePath);
    const range = c.req.header("range");
    const mimeType = mime.getType(filePath) ?? "application/octet-stream";

    // --- Add caching headers ---
    const lastModified = stats.mtime.toUTCString();

    // Simple hash-based ETag (optional: you could use stats.size + mtimeMs)
    const etag = createHash("md5")
      .update(`${stats.size}-${stats.mtimeMs}`)
      .digest("hex");

    // Handle conditional requests
    const ifNoneMatch = c.req.header("if-none-match");
    const ifModifiedSince = c.req.header("if-modified-since");

    if (ifNoneMatch === etag || ifModifiedSince === lastModified) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr ?? "0", 10);
      const end = endStr ? parseInt(endStr, 10) : stats.size - 1;
      const chunkSize = end - start + 1;
      const file = await readFile(filePath);

      return new Response(file.subarray(start, end + 1), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": mimeType,
          ETag: etag,
          "Last-Modified": lastModified,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Content-Length": stats.size.toString(),
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        ETag: etag,
        "Last-Modified": lastModified,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof Error) {
      log({ error: e }, e.message);
    }
    return c.notFound();
  }
}

app.get(`${zAnkiCollectionMediaUrlPath.value}:filename`, async (c) => {
  const filename = c.req.param("filename");
  const mediaDir = await waitForAnkiMediaDir();
  if (!mediaDir) {
    return c.notFound();
  }
  const filePath = join(mediaDir, filename);
  return handleMediaRequest(c, { filePath });
});

// during development, we use vite dev server
if (!env.DEV) {
  // Serve static assets
  app.get("/assets/*", async (c) => {
    const relPath = c.req.path.replace("/assets/", "");
    const filePath = join(env.RENDERER_PATH, "assets", relPath);
    return handleMediaRequest(c, { filePath });
  });

  app.get("*", async (c) => {
    const html = await readFile(join(env.RENDERER_PATH, "index.html"), "utf8");
    return c.html(html);
  });
}

export function startHttpServer() {
  log.info(`Starting HTTP server on port ${env.HTTP_SERVER_PORT}`);
  serve({
    fetch: app.fetch,
    port: env.HTTP_SERVER_PORT,
  });
}
