import type { ToastPromiseOptions } from "@repo/preload/ipc";
import { signal } from "alien-signals";
import { mainWindow } from "#/window/main";
import { IPC } from "./base";

type ToastPromiseResultOptions = Omit<
  Omit<ToastPromiseOptions, "loading">,
  "error"
>;

function createLogIPC() {
  class LogIPC extends IPC()<"log"> {
    toastPromise: Record<string, Promise<ToastPromiseResultOptions>> = {};
    constructor() {
      super({
        prefix: "log",
        win: () => [mainWindow().win],
      });
    }

    override register() {
      this.handle("log:toastPromise", async (_, { uuid }) => {
        if (this.toastPromise[uuid]) {
          return await this.toastPromise[uuid];
        }
        return {
          success: {
            title: "Invalid Toast Promise UUID",
            description: "Invalid Toast Promise UUID",
          },
          error: {
            title: "Invalid Toast Promise UUID",
            description: "Invalid Toast Promise UUID",
          },
        };
      });
    }

    sendToastPromise(
      promise: Promise<ToastPromiseResultOptions>,
      toast: Omit<ToastPromiseOptions, "success">,
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
