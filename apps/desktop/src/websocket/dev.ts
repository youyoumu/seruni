import { signal } from "alien-signals";
import { app } from "electron";
import { textractorClient } from "#/client";
import { AppWebsocket } from "./base";

hmr.log(import.meta.url);

function createDevWS() {
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
  return new DevWS();
}

export const devWS = signal(createDevWS());
