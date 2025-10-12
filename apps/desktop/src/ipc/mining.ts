import { signal } from "alien-signals";
import { obsClient } from "#/client";
import { hmr } from "#/util/hmr";
import { mainWindow } from "#/window/main";
import { IPC } from "./base";

function createMiningIPC() {
  class MiningIPC extends IPC()<"mining"> {
    textUuid = "";
    constructor() {
      super({
        prefix: "mining",
        win: () => [mainWindow().win],
      });
    }

    override register() {
      this.handle("mining:setTextUuid", async (_, { uuid }) => {
        this.textUuid = uuid;
        return { uuid: this.textUuid };
      });
      this.handle("mining:getSourceScreenshot", async () => {
        const currentProgramScene = await obsClient()
          .client?.call("GetCurrentProgramScene")
          .catch(() => {});
        const sourceScreenshot = await obsClient()
          .client?.call("GetSourceScreenshot", {
            imageFormat: "jpeg",
            sourceUuid: currentProgramScene?.sceneUuid,
          })
          .catch(() => {});

        return { image: sourceScreenshot?.imageData ?? null };
      });
    }
  }

  return new MiningIPC();
}

export const miningIPC = signal(createMiningIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.miningIPC().register();
  });
  import.meta.hot.dispose(() => {
    miningIPC().unregister();
  });
}
