import type { ToastPromiseOptions } from "@repo/preload/ipc";
import { IPC } from "./base";

hmr.log(import.meta.url);

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

export const logIPC = hmr.module(createLogIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    mod?.logIPC().register();
  });
  import.meta.hot.dispose(() => {
    logIPC().unregister();
  });
}
