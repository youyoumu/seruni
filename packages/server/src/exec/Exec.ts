import child_process from "node:child_process";

import type { State } from "#/state/state";
import { anyCatch } from "#/util/result";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

export class Exec {
  log: Logger;

  constructor(
    public logger: Logger,
    public state: State,
    public bin: string,
    public name: string,
  ) {
    this.log = logger.child({ name });
  }

  run(params: string[], options: { env?: Record<string, string> } = {}) {
    return this.exec(this.bin, params, options);
  }

  async exec(
    bin: string,
    params: string[],
    options: { env?: Record<string, string> } = {},
  ): Promise<R.Result<{ stdout: string; stderr: string }, Error>> {
    this.log.debug(`Spawning: ${params.join(" ")}`);
    const { promise, resolve, reject } = Promise.withResolvers<{
      stdout: string;
      stderr: string;
    }>();

    const subprocess = child_process.spawn(bin, params, {
      env: options.env,
    });
    let stdout = "";
    let stderr = "";

    const logStdout = this.log.child({ name: `${this.name}.stdout` });
    const logStderr = this.log.child({ name: `${this.name}.stderr` });

    subprocess.stdout?.on("data", (data) => {
      const txt = data.toString();
      stdout += txt;
      const trimmed = txt.trim();
      if (trimmed) logStdout.trace(`${trimmed.includes("\n") ? "\n" : ""}${trimmed}`);
    });

    subprocess.stderr?.on("data", (data) => {
      const txt = data.toString();
      stderr += txt;
      const trimmed = txt.trim();
      if (trimmed) logStderr.trace(`${trimmed.includes("\n") ? "\n" : ""}${trimmed}`);
    });

    subprocess.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Process ${this.name} exited with code ${code}\n${stderr}`));
      }
    });

    subprocess.on("error", (err) => reject(err));

    return await R.pipe(
      R.try({ try: () => promise, catch: anyCatch(`Error when running ${this.name}`) }),
      R.andThen(({ stdout, stderr }) => R.succeed({ stdout, stderr })),
    );
  }
}
