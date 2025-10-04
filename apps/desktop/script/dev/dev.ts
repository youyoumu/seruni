import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path, { join } from "node:path";
import { createSocketClient } from "@repo/preload/websocket";
import chokidar from "chokidar";

//TODO: make more structured
const envJson = (() => {
  try {
    return JSON.parse(
      readFileSync(join(import.meta.dirname, "../../env.json"), "utf-8"),
    );
  } catch {
    console.error("Failed to read env.json");
    return {};
  }
})();

let child: ChildProcess;
let restarting = false;

const preloadDir = path.join(
  import.meta.dirname,
  "../../../../packages/preload/dist/_preload/",
);
const ipcPath = path.join(
  import.meta.dirname,
  "../../../../packages/preload/dist/_preload/ipc.js",
);

let wsClient: ReturnType<typeof createSocketClient> | undefined;
async function setupWsClient() {
  wsClient = createSocketClient(`ws://localhost:${envJson.WS_PORT}`, {});

  wsClient.socket.on("connect", () => {
    console.log(`WS client connected with id ${wsClient?.socket.id}`);
  });
  wsClient.socket.on("disconnect", async () => {
    console.log(`WS client disconnected`);
  });
  wsClient.on("dev:restart", (callback) => {
    restarting = true;
    callback?.();
  });
}

function waitForFileAdd(filePath: string) {
  return new Promise<void>((resolve) => {
    const watcher = chokidar.watch(filePath, { persistent: true });
    watcher.on("add", () => {
      watcher.close();
      resolve();
    });
  });
}

const handleTerminationSignal = (signal: "SIGINT" | "SIGTERM") => {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};

async function start() {
  child = spawn("./script/dev/dev.sh", { stdio: "inherit" });
  child.on("close", (code) => {
    if (restarting) {
      console.log("Restarting dev server");
      restarting = false;
      start();
      return;
    }
    if (code === null) {
      process.exit(1);
    }
    process.exit(code);
  });

  handleTerminationSignal("SIGINT");
  handleTerminationSignal("SIGTERM");
}

function watch() {
  console.log(`Watching ${ipcPath}`);
  chokidar
    .watch(ipcPath, { ignoreInitial: true })
    // .on("all", (event, path) => {
    //   console.log(`Chokidar event ${event} detected on ${path}`);
    //   handleFileEvent(path);
    // })
    // .on("add", (path) => {
    //   console.log(`Chokidar event 'add' detected on ${path}`);
    //   handleFileEvent(path);
    // })
    .on("change", (path) => {
      console.log(`Chokidar event 'change' detected on ${path}`);
      handleFileEvent(path);
    });
}

function handleFileEvent(filePath: string) {
  const fileName = path.basename(filePath);
  if (wsClient?.socket.connected) {
    restarting = true;
    wsClient.emit("dev:fileChange", { fileName });
  } else {
    console.log("WS Client not connected, failed to emit");
  }
}

async function init() {
  await waitForFileAdd(ipcPath);
  await start();
  await setupWsClient();

  setTimeout(() => {
    watch();
  }, 2000);
}

init();
