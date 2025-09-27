import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import chokidar from "chokidar";

let child: ChildProcess | null;

function build() {
  if (child) {
    console.log("Building is already in progress");
    return;
  }
  child = spawn("tsdown", ["--no-clean"], { stdio: "inherit" });
  child.on("exit", () => {
    child = null;
  });
}

chokidar
  .watch(path.resolve(path.join(import.meta.dirname, "../src/")))
  .on("ready", () => {
    console.log("Watching for changes");
  })
  .on("change", (path) => {
    console.log(`Change detected on ${path}`);
    build();
  });
