import fs from "node:fs/promises";
import { join } from "node:path";

import type { AppContext } from "#/types/types";
import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

const app = new Hono<{ Variables: { ctx: AppContext } }>();

app.get(`/:filename`, async (c, next) => {
  const { ankiConnectClient } = c.get("ctx");
  const filename = c.req.param("filename");
  const mediaDirResult = await ankiConnectClient.getMediaDir();
  if (mediaDirResult.isErr()) return c.notFound();
  const filePath = join(mediaDirResult.value, filename);

  return serveStatic({
    getContent: async () => {
      return await fs.readFile(filePath);
    },
  })(c, next);
});

export { app as ankiCollectionMedia };
