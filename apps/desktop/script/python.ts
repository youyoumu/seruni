import { spawn } from "node:child_process";
import path from "node:path";

const pythonBinPath = path.join(
  import.meta.dirname,
  "../../../packages/python/.venv/bin/python",
);

const pythonEntryPath = path.join(
  import.meta.dirname,
  "../../../packages/python/src/main.py",
);

export async function runPython() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pythonBinPath, [pythonEntryPath]);

    child.stdout.on("data", (d) => console.log(d.toString()));
    child.stderr.on("data", (d) => console.log(d.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`Child process exited with code ${code}`);
        resolve();
      } else {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });
  });
}

runPython();
