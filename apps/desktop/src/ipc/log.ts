import type {
  ToastPromiseOptionsError,
  ToastPromiseOptionsLoading,
  ToastPromiseOptionsSuccess,
} from "@repo/preload/ipc";
import { IPC } from "./base";

type ToastPayloadPromise = Promise<
  Partial<ToastPromiseOptionsSuccess> & Partial<ToastPromiseOptionsError>
>;

class LogIPC extends IPC()<"log"> {
  toastPromise: Record<string, ToastPayloadPromise> = {};
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
        error: {
          title: "Invalid Toast Promise UUID",
        },
      };
    });
  }

  sendToastPromise(
    handler: () => ToastPayloadPromise,
    toast: ToastPromiseOptionsLoading,
  ) {
    const uuid = crypto.randomUUID();
    this.toastPromise[uuid] = handler();
    this.send("log:toastPromise", {
      uuid,
      ...toast,
    });
    return this.toastPromise[uuid];
  }
}

export const logIPC = hmr.module(new LogIPC());

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
