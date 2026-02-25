import type { State } from "#/state/state";
import { anyFail } from "#/util/result";
import { R } from "@praha/byethrow";
import { execa } from "execa";
import type { Logger } from "pino";

export class Exec {
  log: Logger;
  state: State;
  bin: string;
  name: string;
  constructor({
    logger,
    state,
    bin,
    name,
  }: {
    logger: Logger;
    state: State;
    bin: string;
    name: string;
  }) {
    this.log = logger.child({ name });
    this.state = state;
    this.bin = bin;
    this.name = name;
  }

  async run(
    params: string[],
    options: { env?: Record<string, string> } = {},
  ): Promise<R.Result<{ stdout: string; stderr: string }, Error>> {
    this.log.debug(`Exec ${params.join(" ")}`);
    const subprocess = execa({
      env: options.env,
    })(this.bin, params);

    const logStdout = this.log.child({ name: `${this.name}.stdout` });
    const logStderr = this.log.child({ name: `${this.name}.stderr` });
    subprocess.stdout?.on("data", (data) => {
      const txt: string = data.toString().trim();
      logStdout.trace(`${txt.includes("\n") ? "\n" : ""}${txt}`);
    });
    subprocess.stderr?.on("data", (data) => {
      const txt: string = data.toString().trim();
      logStderr.trace(`${txt.includes("\n") ? "\n" : ""}${txt}`);
    });

    try {
      const { stdout, stderr } = await subprocess;
      return R.succeed({ stdout, stderr });
    } catch (e) {
      return e instanceof Error ? R.fail(e) : anyFail(`Error when running ${this.name}`);
    }
  }

  safeExeca = R.fn({
    try: (file: string, args: string[] = []) => execa(file, args),
    catch: (e) => (e instanceof Error ? e : new Error(`Error when running ${this.name}`)),
  });
}
