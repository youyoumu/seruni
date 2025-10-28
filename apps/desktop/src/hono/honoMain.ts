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

const app = new Hono();

app.use("*", cors());

//  ──────────────────────────────── Hono ─────────────────────────────
import { app as app_anki__collection_media } from "./anki/collections.media";
import { app as app_anki__connect } from "./anki/connect/";
import { app as app_storage } from "./storage/";

// biome-ignore format: this looks better
(() => {
app.route(zAnkiCollectionMediaUrlPath.parse("/anki/collection.media/"), app_anki__collection_media);
app.route(zAnkiConnectUrlPath.parse("/anki/connect/"), app_anki__connect);
app.route(zAnkiConnectUrlPath.parse("/anki/connect/").replace(/\/$/, ""), app_anki__connect); // allow without trailing slash
app.route(zStorageUrlPath.parse("/storage/"), app_storage);
})()

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
