import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Context, HonoRequest } from "hono";
import mime from "mime";
import z from "zod";
import { ankiClient } from "#/client/clientAnki";
import { bus } from "#/util/bus";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { zAnkiConnectAddNote } from "#/util/schema";

export const interceptedRequest = new Map<string, HonoRequest>();
export const yomitanAnkiConnectSettings = {
  expressionField: "",
  deckName: "",
};

function extractUuid(sentence: string) {
  const match = sentence.match(/‹uuid:([0-9a-f-]{36})›/);
  return match?.[1] ?? null;
}

function stripUuid(sentence: string) {
  return sentence.replace(/‹uuid:[0-9a-f-]{36}›/, "");
}

export async function parseAddNoteRequest(req: HonoRequest) {
  const body = await req.arrayBuffer();
  const bodyText = new TextDecoder().decode(body);
  const bodyJson = JSON.parse(bodyText);

  const ankiConnectAddNote = zAnkiConnectAddNote.parse(bodyJson);
  const sentence =
    ankiConnectAddNote.params.note.fields[config.store.anki.sentenceField];
  if (sentence === undefined)
    throw new Error("Sentence field is missing, invalid config?");
  const uuid = extractUuid(sentence);
  if (uuid === null) throw new Error("UUID not found");
  log.trace({ uuid }, "Extracted UUID from sentence");

  for (const key of Object.keys(ankiConnectAddNote.params.note.fields)) {
    const value = ankiConnectAddNote.params.note.fields[key];
    if (!value) continue;
    const strippedValue = stripUuid(value);
    ankiConnectAddNote.params.note.fields[key] = strippedValue;
  }
  const newBody = JSON.stringify(ankiConnectAddNote);

  return { uuid, body: newBody };
}

export const proxyAnkiConnectAddNoteRequest = async (req: HonoRequest) => {
  const url = new URL(req.url);
  const target = `http://localhost:${config.store.anki.ankiConnectPort}${url.pathname}${url.search}`;
  const { uuid, body } = await parseAddNoteRequest(req);
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
    const noteId = z
      .union([z.number(), z.object({ result: z.number() })])
      .parse(resJson);
    if (typeof noteId === "number") {
      bus.emit("anki:handleUpdateNoteMedia", {
        noteId: noteId,
        selectedTextUuid: uuid,
      });
    } else if (typeof noteId === "object") {
      bus.emit("anki:handleUpdateNoteMedia", {
        noteId: noteId.result,
        selectedTextUuid: uuid,
      });
    } else {
      throw new Error("Invalid response from AnkiConnect");
    }
  } catch (e) {
    //TODO: sent error toast
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
