import { ankiClient } from "#/client/anki";
import { obsClient } from "#/client/obs";
import { textractorClient } from "#/client/textractor";
import { env } from "#/env";
import { IPC } from "./base";

hmr.log(import.meta);

class GeneralIPC extends IPC()<"general"> {
  ready = Promise.withResolvers<boolean>();
  constructor() {
    super({
      prefix: "general",
    });
  }

  override register() {
    this.on("general:ready", (_) => {
      this.ready.resolve(true);
    });

    this.handle("general:getClientStatus", async () => {
      return {
        anki: ankiClient().status,
        obs: obsClient().status,
        textractor: textractorClient().status,
      };
    });

    this.handle("general:httpServerUrl", async () => {
      return { url: env.HTTP_SERVER_URL };
    });
  }
}

export const generalIPC = hmr.module(new GeneralIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { generalIPC } = await hmr.register<typeof import("./general")>(
    import.meta,
  );
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    generalIPC().register();
  });
  import.meta.hot.dispose(() => {
    generalIPC().unregister();
  });
}
