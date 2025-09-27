import { spawn } from "node:child_process";
import chokidar from "chokidar";

let child;

function build() {
  if (child) {
    console.log("Building is already in progress");
    return;
  }
  child = spawn("tsdown", { stdio: "inherit" });
  child.on("exit", () => {
    child = null;
  });
}

chokidar
  .watch("./src")
  .on("ready", () => {
    console.log("Watching for changes");
    build();
  })
  .on("change", (path) => {
    console.log(`Change detected on ${path}`);
    build();
  });
