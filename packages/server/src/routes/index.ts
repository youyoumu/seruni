import fs from "node:fs/promises";
import path from "node:path";

import type { AppContext } from "#/types/types";
import { Hono } from "hono";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("/", async (c) => {
  const { state } = c.get("ctx");
  const html = await fs.readFile(path.join(state.path().webuiDir, "index.html"), "utf8");
  return c.html(html);
});

export { app as indexRoute };
