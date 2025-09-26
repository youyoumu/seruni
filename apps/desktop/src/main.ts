import { app } from "electron";
import { env } from "./env";
import { IPC } from "./ipc/_util";
import { logIPC } from "./ipc/log";
import { settingsIPC } from "./ipc/settings";
import { vnOverlayIPC } from "./ipc/vnOverlay";
import { yomitanIPC } from "./ipc/yomitan";
import { log } from "./util/logger";
import { mainWindow } from "./window/main";

// NOTE: Workaround for https://github.com/electron/electron/issues/41614
app.on("web-contents-created", (_, contents) => {
  contents.on("devtools-opened", () =>
    contents.devToolsWebContents?.executeJavaScript(`
        (() => {
            const origErr = console.error;
            console.error = function (...args) {
                const s = String(args[0] ?? "");
                if (s.includes("Autofill.enable") || s.includes("Autofill.setAddresses")) return;
                return origErr.apply(console, args);
            };
        })()
    `),
  );
});

export async function bootstrap() {
  log.debug(env, "env value");
  IPC.registerAll();

  await app.whenReady();
  mainWindow.open();
}

bootstrap();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log.warn("HMR update detected on the main process, reloading...");
    app.exit(100);
  });
  import.meta.hot.accept();
}
