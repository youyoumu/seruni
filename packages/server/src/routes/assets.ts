import fs from "node:fs/promises";
import path from "node:path";

import type { AppContext } from "#/types/types";
import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("*", (c, next) => {
  const { state } = c.get("ctx");
  return serveStatic({
    getContent: async (filePath) => {
      const resolvedPath = path.join(state.path().webuiDir, filePath);
      return await fs.readFile(resolvedPath);
    },
  })(c, next);
});

export { app as assetsRoute };
