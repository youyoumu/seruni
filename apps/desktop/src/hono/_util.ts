import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Context, HonoRequest } from "hono";
import mime from "mime";
import z from "zod";
import { ankiClient } from "#/client/clientAnki";
import { bus } from "#/util/bus";
import { config } from "#/util/config";
import { log } from "#/util/logger";

export const interceptedRequest = new Map<string, HonoRequest>();
export const yomitanAnkiConnectSettings = {
  expressionField: "",
  deckName: "",
};

export const proxyAnkiConnectNewNoteRequest = async (req: HonoRequest) => {
  const url = new URL(req.url);
  const target = `http://localhost:${config.store.anki.ankiConnectPort}${url.pathname}${url.search}`;
  const body = await req.arrayBuffer();
  const res = await fetch(target, {
    method: req.method,
    headers: req.raw.headers,
    body,
  });
  const resClone = res.clone();
  try {
    const noteId = z
      .union([z.number(), z.object({ result: z.number() })])
      .parse(await resClone.json());
    if (typeof noteId === "number") {
      bus.emit("anki:handleUpdateNoteMedia", {
        noteId: noteId,
      });
    } else if (typeof noteId === "object") {
      bus.emit("anki:handleUpdateNoteMedia", {
        noteId: noteId.result,
      });
    } else {
      throw new Error("Invalid response from AnkiConnect");
    }
  } catch (e) {
    log.error({ error: e }, e instanceof Error ? e.message : "Unknown Error");
  }

  return res;
};

export function waitForAnkiMediaDir() {
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

export async function handleMediaRequest(
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
