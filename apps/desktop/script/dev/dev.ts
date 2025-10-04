import { type ChildProcess, spawn } from "node:child_process";
import crypto from "node:crypto";
import { constants, readFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
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
const fileHashes = new Map();

const preloadDir = path.join(
  import.meta.dirname,
  "../../../../packages/preload/dist/_preload/",
);
const ipcPath = path.join(
  import.meta.dirname,
  "../../../../packages/preload/dist/_preload/ipc.js",
);
const wsPortFilePath = join(
  import.meta.dirname,
  "../../.userData/temp/ws_port.txt",
);

async function readAssignedPort() {
  const data = await readFile(wsPortFilePath, "utf8");
  return Number(data.trim());
}

let wsClient: ReturnType<typeof createSocketClient> | undefined;
async function setupWsClient() {
  const port = await readAssignedPort();
  wsClient = createSocketClient(`ws://localhost:${port}`, {});

  wsClient.socket.on("connect", () => {
    console.log(`WS client connected with id ${wsClient?.socket.id}`);
  });
  wsClient.socket.on("disconnect", async () => {
    console.log(`WS client disconnected`);
    const { waitForChange } = await setupFileWatcher(wsPortFilePath);
    await waitForChange();
    setupWsClient();
  });
  wsClient.on("dev:restart", (callback) => {
    restarting = true;
    callback?.();
  });
}

async function ensureExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function setupFileWatcher(filePath: string) {
  const watcher = chokidar.watch(filePath, { persistent: true });

  // Create a promise + resolver pair
  const { promise, resolve } = Promise.withResolvers<void>();

  const exists = await ensureExists(filePath);

  if (exists) {
    watcher.on("change", () => {
      resolve();
      watcher.close();
    });
  } else {
    watcher.on("add", () => {
      resolve();
      watcher.close();
    });
  }

  return {
    waitForChange() {
      return promise;
    },
    close() {
      watcher.close();
    },
  };
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

function start() {
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
    .on("add", (path) => {
      console.log(`Chokidar event 'add' detected on ${path}`);
      handleFileEvent(path);
    })
    .on("change", (path) => {
      console.log(`Chokidar event 'change' detected on ${path}`);
      handleFileEvent(path);
    });
}

function hashFile(filePath: string) {
  const buffer = readFileSync(filePath);
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function handleFileEvent(filePath: string) {
  try {
    const newHash = hashFile(filePath);
    const oldHash = fileHashes.get(filePath);
    const fileName = path.basename(filePath);

    if (newHash !== oldHash) {
      console.log(`Hash changed for ${fileName}: ${oldHash} → ${newHash}`);
      fileHashes.set(filePath, newHash);

      if (wsClient?.socket.connected) {
        restarting = true;
        wsClient.emit("dev:fileChange", { fileName });
      } else {
        console.log("WS Client not connected, failed to emit");
      }
    } else {
      console.log(`Hash unchanged for ${path.basename(filePath)}`);
    }
  } catch (err) {
    console.error(`Error hashing ${filePath}:`, err);
  }
}

async function init() {
  const { waitForChange } = await setupFileWatcher(wsPortFilePath);
  start();
  await waitForFileAdd(ipcPath);

  const initialHash = hashFile(ipcPath);
  fileHashes.set(ipcPath, initialHash);

  watch();
  await waitForChange();
  await setupWsClient();
}

init();
