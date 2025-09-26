import { spawn } from "node:child_process";

let child;

const handleTerminationSignal = (signal) => {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};

function start() {
  child = spawn("./script/dev.sh", { stdio: "inherit" });
  child.on("close", (code) => {
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

start();
