import { signal } from "alien-signals";
import { hmr } from "#/util/hmr";
import { mainWindow } from "#/window/main";
import { IPC } from "./base";

function createLogIPC() {
  class LogIPC extends IPC()<"log"> {
    toastPromise: Record<string, Promise<void>> = {};
    constructor() {
      super({
        prefix: "log",
        win: () => [mainWindow().win],
      });
    }

    override register() {
      this.handle("log:toastPromise", async (_, { uuid }) => {
        if (this.toastPromise[uuid]) {
          await this.toastPromise[uuid];
        }
      });
    }

    sendToastPromise(
      promise: Promise<void>,
      toast: {
        loading: {
          title: string;
          description: string;
        };
        success: {
          title: string;
          description: string;
        };
        error: {
          title: string;
          description: string;
        };
      },
    ) {
      const uuid = crypto.randomUUID();
      this.toastPromise[uuid] = promise;
      this.send("log:toastPromise", {
        uuid,
        ...toast,
      });
    }
  }
  return new LogIPC();
}

export const logIPC = signal(createLogIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.logIPC().register();
  });
  import.meta.hot.dispose(() => {
    logIPC().unregister();
  });
}
