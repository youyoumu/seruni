import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path, { join } from "node:path";
import { createSocketClient, type WsClient } from "@repo/preload/websocket";
import chokidar, { type FSWatcher } from "chokidar";

process.env.ROARR_LOG = "true";
const { Roarr, ROARR } = await import("roarr");
const roarr = spawn("roarr", ["--output-format", "pretty"], {
  stdio: ["pipe", "inherit", "inherit"],
});

ROARR.write = (message) => {
  roarr.stdin.write(`${message}\n`);
};

class DevManager {
  child?: ChildProcess;
  wsClient?: WsClient;
  watcher?: FSWatcher;
  restarting = false;

  env: {
    PRELOAD_DIR: string;
    IPC_PATH: string;
    WS_PORT: number;
  };

  log = Roarr.child((message) => {
    message.context.namespace = "DEV";
    return message;
  }).debug;
  roarr = spawn("roarr", ["--output-format", "pretty"], {
    stdio: ["pipe", "inherit", "inherit"],
  });

  constructor() {
    const env = this.loadEnv();
    const PRELOAD_DIR = path.join(
      import.meta.dirname,
      "../../../../packages/preload/dist/_preload/",
    );
    this.env = {
      PRELOAD_DIR,
      IPC_PATH: path.join(PRELOAD_DIR, "ipc.js"),
      WS_PORT: Number(env.WS_PORT),
    };
  }

  loadEnv(): Record<string, string | number | undefined | null> {
    try {
      const envPath = join(import.meta.dirname, "../../env.json");
      return JSON.parse(readFileSync(envPath, "utf-8"));
    } catch {
      console.error("Failed to read env.json");
      return {};
    }
  }

  spawnElectronWithRoarr(): ChildProcess {
    const ELECTRON_BIN = process.env.ELECTRON_BIN || "electron";
    const args = ["."];

    if (process.env.SSH_PREFER_FISH !== "1") {
      args.unshift("--ozone-platform=wayland");
    }
    const electron = spawn(ELECTRON_BIN, args, {
      stdio: ["inherit", "pipe", "inherit"],
    });

    electron.stdout.pipe(this.roarr.stdin);
    return electron;
  }

  async setupWebSocket() {
    this.wsClient = createSocketClient(
      `ws://localhost:${this.env.WS_PORT}`,
      {},
    );
    this.wsClient.socket.on("connect", () => {
      this.log(`WS client connected with id ${this.wsClient?.socket.id}`);
    });
    this.wsClient.socket.on("disconnect", () => {
      this.log("WS client disconnected");
    });
    this.wsClient.on("dev:restart", (callback) => {
      this.restarting = true;
      callback?.();
    });
  }

  async waitForFile(filePath: string) {
    return new Promise<void>((resolve) => {
      const watcher = chokidar.watch(filePath, { persistent: true });
      watcher.on("add", () => {
        watcher.close();
        resolve();
      });
    });
  }

  setupTerminationHandlers() {
    const handle = (signal: "SIGINT" | "SIGTERM") => {
      if (this.child && !this.child.killed) {
        this.child.kill(signal);
      }
    };
    process.on("SIGINT", () => handle("SIGINT"));
    process.on("SIGTERM", () => handle("SIGTERM"));
  }

  async start() {
    this.child = this.spawnElectronWithRoarr();
    this.child.on("close", (code) => {
      if (this.restarting) {
        this.log("Restarting dev server...");
        this.restarting = false;
        this.start();
        return;
      }
      if (code === null) process.exit(1);
      process.exit(code);
    });
    this.setupTerminationHandlers();
  }

  startWatching() {
    this.log(`Watching ${this.env.IPC_PATH}`);
    this.watcher = chokidar
      .watch(this.env.IPC_PATH, { ignoreInitial: true })
      .on("change", (path) => {
        this.log(`Change detected on ${path}`);
        this.handleFileChange(path);
      });
  }

  handleFileChange(filePath: string) {
    const fileName = path.basename(filePath);
    if (this.wsClient?.socket.connected) {
      this.restarting = true;
      this.wsClient.emit("dev:fileChange", { fileName });
    } else {
      this.log("WS Client not connected, failed to emit file change");
    }
  }

  async init() {
    await this.waitForFile(this.env.IPC_PATH);
    await this.start();
    await this.setupWebSocket();
    setTimeout(() => this.startWatching(), 2000);
  }
}

const dev = new DevManager();
dev.init();
