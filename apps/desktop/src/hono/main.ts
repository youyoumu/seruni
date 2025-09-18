import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import mime from "mime";
import { env } from "#/env";
import { log } from "#/util/logger";

const app = new Hono();

// Serve static assets
app.get("/assets/*", async (c) => {
  const relPath = c.req.path.replace("/assets/", "");
  const filePath = join(env.RENDERER_PATH, "assets", relPath);
  try {
    const buf = await readFile(filePath);
    return new Response(buf, {
      headers: {
        "Content-Type": mime.getType(filePath) || "application/octet-stream",
      },
    });
  } catch {
    return c.notFound();
  }
});

app.get("*", async (c) => {
  const html = await readFile(join(env.RENDERER_PATH, "index.html"), "utf8");
  return c.html(html);
});

log(`Starting HTTP server on port ${3000}`);
serve({
  fetch: app.fetch,
  port: 3000,
});
