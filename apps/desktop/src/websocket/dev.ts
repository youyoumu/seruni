import { app } from "electron";
import WebSocket from "ws";
import { log } from "#/util/logger";

//TODO: make classes for WS
export function connectControl() {
  const ws = new WebSocket("ws://localhost:3001");

  ws.on("open", () => {
    console.log("Connected to parent WS server");
  });

  //TODO: make type for WS
  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());
    if (data?.type === "file_change") {
      if (data?.payload?.name === "ipc_preload") {
        log.debug(data, "WS message");
        //TODO: exit with WS
        app.exit(100);
      }
    }
  });

  ws.on("close", () => {
    // Parent died? Quit too
    app.exit();
  });
}
