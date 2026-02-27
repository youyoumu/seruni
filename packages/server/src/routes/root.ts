import path from "node:path";

import type { AppContext } from "#/types/types";
import { safeReadFile } from "#/util/fs";
import { R } from "@praha/byethrow";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("/", async (c) => {
  const { state } = c.get("ctx");
  const html = await safeReadFile(path.join(state.path().webuiDir, "index.html"), "utf8");
  if (R.isFailure(html)) throw new HTTPException(500, { message: "Failed to read index.html" });
  return c.html(html.value);
});

export { app as root };
