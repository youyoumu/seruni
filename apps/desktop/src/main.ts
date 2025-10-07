import { app } from "electron";
import { prepareAllClient, textractorClient } from "./client";
import { env } from "./env";
import { serveHttp } from "./hono/main";
import { IPC } from "./ipc";
import { generalIPC } from "./ipc/general";
import { hmr } from "./util/hmr";
import { log } from "./util/logger";
import { AppWebsocket, devWS } from "./websocket";
import { mainWindow } from "./window/main";
import { yomitanWindow } from "./window/yomitan";

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
  await app.whenReady();
  IPC().registerAll();
  serveHttp();
  await yomitanWindow().loadYomitan();
  await mainWindow().open();
  await generalIPC().ready.promise;

  log.debug(env, "env value");
  await AppWebsocket().registerAll();
  await prepareAllClient();
}

bootstrap();

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
  });

  import.meta.hot.dispose(async () => {
    log.warn("HMR update detected on the main process, reloading...");
    textractorClient().client?.close();
    await devWS().register();
    devWS().emit("dev:restart", () => {
      app.exit();
    });
  });
}
