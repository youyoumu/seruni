import { spawn } from "node:child_process";
import { env } from "#/env";
import { log } from "./logger";

export async function python(params: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(env.PYTHON_BIN_PATH, [
      env.PYTHON_ENTRY_PATH,
      ...params,
    ]);

    let output = "";
    child.stdout.on("data", (d) => {
      output += d.toString();
      log.trace(d.toString());
    });
    child.stderr.on("data", (d) => {
      log.error(d.toString());
    });

    child.on("close", (code) => {
      if (code === 0) {
        log.info(`Child process exited with code ${code}`);
        resolve(output);
      } else {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });
  });
}
