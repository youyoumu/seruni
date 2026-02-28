import path from "node:path";

import type { AppContext } from "#/types/types";
import { safeReadFile } from "#/util/fs";
import { R } from "@praha/byethrow";
import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get("*", (c, next) => {
  const { state } = c.get("ctx");
  return serveStatic({
    getContent: async (filePath) => {
      const resolvedPath = path.join(state.path().webuiDir, filePath);
      const file = await safeReadFile(resolvedPath);
      if (R.isFailure(file)) return c.notFound();
      return file.value;
    },
  })(c, next);
});

export { app as assets };
