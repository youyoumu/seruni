import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const pythonBinPath = path.join(
  import.meta.dirname,
  "../../../packages/python/.venv/bin/python",
);

const pythonEntryPath = path.join(
  import.meta.dirname,
  "../../../packages/python/src/main.py",
);

const inputPath = path.join(
  import.meta.dirname,
  "../../../packages/python/src/sample.wav",
);

export async function runPython() {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBinPath, [pythonEntryPath, inputPath]);

    let output = "";
    child.stdout.on("data", (d) => {
      output += d.toString();
      console.log(d.toString());
    });
    child.stderr.on("data", (d) => console.log(d.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`Child process exited with code ${code}`);
        resolve(output);
      } else {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });
  });
}
