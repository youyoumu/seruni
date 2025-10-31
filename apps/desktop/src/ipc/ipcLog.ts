import type {
  LogMessage,
  ToastPromiseOptionsError,
  ToastPromiseOptionsLoading,
  ToastPromiseOptionsSuccess,
} from "@repo/preload/ipc";
import { bus } from "#/util/bus";
import { log } from "#/util/logger";
import { IPC } from "./ipcBase";

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

    this.on("log:invokeAction", (_, { id }) => {
      log.trace(`Invoking action: ${id}`);
      bus.emit("action:invoke", { id });
    });

    const uuid = crypto.randomUUID();
    const listener = (message: LogMessage) => {
      this.send("log:send", message);
    };
    bus.on("logIPC:send", listener);
    this.controller.signal.addEventListener(
      "abort",
      () => {
        log.trace(
          { namespace: `IPC:${this.prefix}` },
          `Removing listener logIPC:send ${uuid}`,
        );
        bus.off("logIPC:send", listener);
      },
      { once: true },
    );
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

const module: typeof import("./ipcLog") = { logIPC };
if (import.meta.hot) {
  const { logIPC } = await hmr.register<typeof import("./ipcLog")>(
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
