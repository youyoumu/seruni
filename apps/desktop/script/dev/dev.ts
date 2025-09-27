import { type ChildProcess, spawn } from "node:child_process";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import chokidar from "chokidar";
import WebSocket, { WebSocketServer } from "ws";

let child: ChildProcess;
let restarting = false;
let wsClient: WebSocket;
const fileHashes = new Map();

const preloadDir = path.join(
  import.meta.dirname,
  "../../../../packages/preload/dist/_preload/",
);
const ipcPath = path.join(
  import.meta.dirname,
  "../../../../packages/preload/dist/_preload/ipc.js",
);

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (socket) => {
  wsClient = socket;
  console.log("Electron connected to control WS");
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
      restarting = false;
      start();
      return;
    }
    if (code === 100) {
      console.log("Restarting dev server");
      return start();
    }
    if (code === null) {
      process.exit(1);
    }
    process.exit(code);
  });

  handleTerminationSignal("SIGINT");
  handleTerminationSignal("SIGTERM");
}

function restart() {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    restarting = true;
    wsClient.send(
      JSON.stringify({
        type: "file_change",
        payload: {
          name: "ipc_preload",
        },
      }),
    );
  } else {
    console.log("Electron not connected, forcing kill");
    restarting = true;
    child.kill("SIGKILL");
  }
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

    if (newHash !== oldHash) {
      console.log(
        `Hash changed for ${path.basename(filePath)}: ${oldHash} → ${newHash}`,
      );
      fileHashes.set(filePath, newHash);
      restart();
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
