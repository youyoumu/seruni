import { app } from "electron";
import { env } from "./env";
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

app.whenReady().then(() => {
  logIPC.register();
  vnOverlayIPC.register();
  yomitanIPC.register();
  settingsIPC.register();

  mainWindow.open();

  log.debug(env, "env value");
  // setInterval(() => {
  //   log.trace("trace");
  //   log.debug({ hello: "world" }, "debug");
  //   log.info("info");
  //   log.warn("warn");
  //   const e = new Error("test");
  //   log.error({ error: e }, `error: ${e.message}`);
  //   log.fatal({ error: e }, `fatal: ${e.message}`);
  // }, 3000);
});
