import { join } from "node:path";

import type { AppContext } from "#/types/types";
import { safeReadFile } from "#/util/fs";
import { R } from "@praha/byethrow";
import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get(`/:filename`, async (c, next) => {
  const { ankiConnectClient } = c.get("ctx");
  const filename = c.req.param("filename");
  const mediaDirResult = await ankiConnectClient.getMediaDir();
  if (R.isFailure(mediaDirResult)) return c.notFound();
  const filePath = join(mediaDirResult.value, filename);

  return serveStatic({
    getContent: async () => {
      const file = await safeReadFile(filePath, "binary");
      if (R.isFailure(file)) return c.notFound();
      return file.value;
    },
  })(c, next);
});

export { app as ankiCollectionMedia };
