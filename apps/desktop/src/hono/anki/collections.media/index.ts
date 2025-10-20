import { join } from "node:path";
import { Hono } from "hono";
import { handleMediaRequest, waitForAnkiMediaDir } from "#/hono/_util";

const app = new Hono();

app.get(`/:filename`, async (c) => {
  const filename = c.req.param("filename");
  const mediaDir = await waitForAnkiMediaDir();
  if (!mediaDir) {
    return c.notFound();
  }
  const filePath = join(mediaDir, filename);
  return handleMediaRequest(c, { filePath });
});

export { app };
