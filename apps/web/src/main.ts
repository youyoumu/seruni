import { definePlugin } from "nitro";
import { logger } from "./util/logger";
import { TextHookerClient } from "./client/text-hooker.client";
import { eventTarget } from "./util/eventTarget";

declare global {
  var HMR: {
    textHookerClient?: TextHookerClient;
  };
}

export default definePlugin((nitroApp) => {
  if (typeof HMR === "undefined") {
    globalThis.HMR = {};
  }
  if (HMR.textHookerClient) {
    HMR.textHookerClient.close();
  }

  HMR.textHookerClient = new TextHookerClient({
    logger,
    et: eventTarget,
  });
});
