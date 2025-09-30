import { type ChildProcess, spawn } from "node:child_process";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createSocketClient } from "@repo/preload/websocket";
import chokidar from "chokidar";

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

const wsClient = createSocketClient("ws://localhost:3001", {});

wsClient.socket.on("connect", () => {
  console.log(`WS client connected with id ${wsClient.socket.id}`);
});
wsClient.on("dev:restart", (callback) => {
  restarting = true;
  callback?.();
});

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

      if (wsClient.socket.connected) {
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

start();
setTimeout(() => {
  const initialHash = hashFile(ipcPath);
  fileHashes.set(ipcPath, initialHash);
}, 2000);
setTimeout(watch, 4000);
