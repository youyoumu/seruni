import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Context } from "node:vm";

import type { AppContext } from "#/types/types";
import { Hono } from "hono";
import mime from "mime";
import type { Logger } from "pino";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get(`/:filename`, async (c) => {
  const { logger, ankiConnectClient } = c.get("ctx");
  const log = logger.child({ name: "anki-collection-media" });
  const filename = c.req.param("filename");
  const mediaDir = await ankiConnectClient.getMediaDir();
  if (!mediaDir || mediaDir instanceof Error) return c.notFound();
  const filePath = join(mediaDir, filename);
  return handleMediaRequest(c, { filePath, log });
});

export async function handleMediaRequest(
  c: Context,
  {
    filePath,
    log,
  }: {
    filePath: string;
    log?: Logger;
  },
) {
  try {
    const stats = await stat(filePath);
    const range = c.req.header("range");
    const mimeType = mime.getType(filePath) ?? "application/octet-stream";

    // --- Add caching headers ---
    const lastModified = stats.mtime.toUTCString();

    // Simple hash-based ETag (optional: you could use stats.size + mtimeMs)
    const etag = createHash("md5").update(`${stats.size}-${stats.mtimeMs}`).digest("hex");

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
      log?.error(e.message);
    }
    return c.notFound();
  }
}

export { app as ankiCollectionMediaRoute };
