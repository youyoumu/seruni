import { app } from "electron";
import { logIPC } from "./ipc/log";
import { overlayIPC } from "./ipc/overlay";
import { yomitanIPC } from "./ipc/yomitan";
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
  overlayIPC.register();
  yomitanIPC.register();

  mainWindow.open();
});
