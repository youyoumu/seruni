import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import {
  zAnkiCollectionMediaUrlPath,
  zAnkiConnectUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "#/env";
import { log } from "#/util/logger";
import { handleMediaRequest } from "./_util";

//  ──────────────────────────────── Hono ─────────────────────────────
import { app as app_anki__collection_media } from "./anki/collections.media";
import { app as app_anki__connect } from "./anki/connect/";
import { app as app_storage } from "./storage/";

const app = new Hono();

app.use("*", cors());

// /anki/collection.media/
app.route(zAnkiCollectionMediaUrlPath.value, app_anki__collection_media);
// /anki/connect/
app.route(zAnkiConnectUrlPath.value, app_anki__connect);
// /storage/
app.route(zStorageUrlPath.value, app_storage);

// during development, we use vite dev server
if (!env.DEV) {
  // vite assets
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
