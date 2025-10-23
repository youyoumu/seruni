import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

const DEFAULT_PORT = 33434;

const argPort = process.argv[2] ? Number(process.argv[2]) : undefined;
const PORT = argPort || DEFAULT_PORT;

const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

// Start roarr CLI subprocess
const roarr = spawn("roarr", ["--output-format", "pretty"], {
  stdio: ["pipe", "inherit", "inherit"],
});

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("message", (message) => {
    roarr.stdin.write(`${message}\n`);
  });
});

console.log(`📡 Log server running on ws://localhost:${PORT}`);

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down log server...");
  roarr.kill("SIGINT");
  wss.close();
  process.exit(0);
});
