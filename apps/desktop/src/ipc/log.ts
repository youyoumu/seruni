import type { ToastPromiseOptions } from "@repo/preload/ipc";
import { IPC } from "./base";

hmr.log(import.meta);

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

const module: typeof import("./log") = { logIPC };
if (import.meta.hot) {
  const { logIPC } = await hmr.register<typeof import("./log")>(
    import.meta,
    module,
  );
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    logIPC().register();
  });
  import.meta.hot.dispose(() => {
    logIPC().unregister();
  });
}
