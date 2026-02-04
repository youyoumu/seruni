import { definePlugin } from "nitro";
import { TextHookerClient } from "./client/text-hooker.client";

export default definePlugin((nitroApp) => {
  const textHookerClient = new TextHookerClient();
});
