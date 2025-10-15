import { app } from "electron";
import { textractorClient } from "#/client/textractor";
import { AppWebsocket } from "./base";

hmr.log(import.meta);

class DevWS extends AppWebsocket()<"dev"> {
  constructor() {
    super({
      prefix: "dev",
    });
  }

  override async register() {
    await super.register();
    this.on("dev:fileChange", ({ fileName }) => {
      if (fileName === "ipc.js") {
        textractorClient().client?.close();
        this.emit("dev:restart", () => {
          app.exit();
        });
      }
    });
  }
}

export const devWS = hmr.module(new DevWS());
