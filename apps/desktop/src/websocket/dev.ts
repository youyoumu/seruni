import { signal } from "alien-signals";
import { app } from "electron";
import { AppWebsocket } from "./base";

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
