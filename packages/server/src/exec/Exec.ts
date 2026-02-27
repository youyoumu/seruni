import type { State } from "#/state/state";
import { anyCatch } from "#/util/result";
import { R } from "@praha/byethrow";
import { execa } from "execa";
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

    return await R.pipe(
      R.try({
        try: () => subprocess,
        catch: anyCatch(`Error when running ${this.name}`),
      }),
      R.andThen(({ stdout, stderr }) => R.succeed({ stdout, stderr })),
    );
  }

  safeExeca = R.fn({
    try: (file: string, args: string[] = []) => execa(file, args),
    catch: (e) => (e instanceof Error ? e : new Error(`Error when running ${this.name}`)),
  });
}
