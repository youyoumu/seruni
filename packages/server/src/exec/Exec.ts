import type { State } from "#/state/state";
import { errFrom } from "#/util/err";
import { execa } from "execa";
import { err, ok, Result, ResultAsync } from "neverthrow";
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

  async run(params: string[]): Promise<Result<{ stdout: string; stderr: string }, Error>> {
    this.log.debug(`Exec ${params.join(" ")}`);
    const subprocess = execa(this.bin, params);

    const logStdout = this.log.child({ name: `${this.name}.stdout` });
    const logStderr = this.log.child({ name: `${this.name}.stderr` });
    subprocess.stdout?.on("data", (data) => {
      logStdout.trace(`${data.toString().trim()}`);
    });
    subprocess.stderr?.on("data", (data) => {
      logStderr.trace(`${data.toString().trim()}`);
    });

    try {
      const { stdout, stderr } = await subprocess;
      return ok({ stdout, stderr });
    } catch (e) {
      return e instanceof Error ? err(e) : errFrom(`Error when running ${this.name}`);
    }
  }

  safeExeca = ResultAsync.fromThrowable(
    (file: string, args: string[] = []) => execa(file, args),
    (e) => (e instanceof Error ? e : new Error(`Error when running ${this.name}`)),
  );
}
