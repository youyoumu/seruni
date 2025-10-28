import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { app, Menu } from "electron";
import { textractorClient } from "./client/clientTextractor";
import { env } from "./env";
import { startHttpServer } from "./hono/honoMain";
import { generalIPC } from "./ipc/ipcGeneral";
import { prepareAllClient } from "./util/client";
import { registerAllIPC } from "./util/ipc";
import { log } from "./util/logger";
import { registerAllWS } from "./util/websocket";
import { devWS } from "./websocket/websocketDev";
import { mainWindow } from "./window/windowMain";
import { yomitanWindow } from "./window/windowYomitan";
import "./db/dbMain";
import { DB, mainDB } from "./db/dbMain";
import { bus } from "./util/bus";
import { config } from "./util/config";
import { registerAllWindow } from "./util/window";

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

app.on("before-quit", () => {
  textractorClient().close();
});

export async function bootstrap() {
  bus.emit("env:ready", env);
  await DB.migrate(mainDB().db);
  await app.whenReady();
  registerAllWindow();
  registerAllIPC();
  startHttpServer();
  await yomitanWindow().loadYomitan();

  const menu = Menu.getApplicationMenu();
  if (menu) {
    menu.items = menu.items.filter(
      (item) => item.role !== "help" && item.label !== "Help",
    );
    const newMenu = Menu.buildFromTemplate(menu.items);
    Menu.setApplicationMenu(newMenu);
  }

  await mainWindow().open();
  await generalIPC().ready.promise;
  log.debug(config.store, "Config value");
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
    log.warn(
      { namespace: "HMR" },
      "HMR update detected on the main.ts, reloading...",
    );
    textractorClient().client?.close();
    devWS().emit("dev:restart", () => {
      app.exit();
    });
  });
}
