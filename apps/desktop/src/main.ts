import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
import { textractorClient } from "./client/textractor";
import { env } from "./env";
import { startHttpServer } from "./hono/main";
import { generalIPC } from "./ipc/general";
import { prepareAllClient } from "./util/client";
import { registerAllIPC } from "./util/ipc";
import { log } from "./util/logger";
import { registerAllWS } from "./util/websocket";
import { devWS } from "./websocket/dev";
import { mainWindow } from "./window/main";
import { yomitanWindow } from "./window/yomitan";

hmr.log(import.meta);

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
  registerAllIPC();
  startHttpServer();
  await yomitanWindow().loadYomitan();
  await mainWindow().open();
  await generalIPC().ready.promise;
  log.debug(env, "Env value");

  registerAllWS();
  await prepareAllClient();

  // remove everything inside temp dir
  const files = await readdir(env.TEMP_PATH);
  for (const file of files) {
    rm(join(env.TEMP_PATH, file), { recursive: true });
  }
}

bootstrap();

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
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
