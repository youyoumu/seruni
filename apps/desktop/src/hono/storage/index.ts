import { join } from "node:path";
import { Hono } from "hono";
import { env } from "#/env";
import { handleMediaRequest } from "../_util";

const app = new Hono();

app.get(`/:filename`, async (c) => {
  const filename = c.req.param("filename");
  const filePath = join(env.STORAGE_PATH, filename);
  return handleMediaRequest(c, { filePath });
});

export { app };
