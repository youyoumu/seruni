import { definePlugin } from "nitro";
import { logger } from "./util/logger";
import { TextHookerClient } from "./client/text-hooker.client";

export default definePlugin((nitroApp) => {
  const textHookerClient = new TextHookerClient({
    logger,
  });
});
