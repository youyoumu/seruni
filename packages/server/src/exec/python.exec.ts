import type { State } from "#/state/state";
import { execa } from "execa";
import type { Logger } from "pino";

export class PythonExec {
  log: Logger;
  state: State;
  constructor({ logger, state }: { logger: Logger; state: State }) {
    this.log = logger.child({ name: "python" });
    this.state = state;
  }

  async run(params: string[]) {
    this.log.info(`Exec ${params.join(" ")}`);
    const subprocess = execa(this.state.path().python, params);

    const logStdout = this.log.child({ name: "stdout" });
    const logStderr = this.log.child({ name: "stderr" });
    subprocess.stdout?.on("data", (data) => {
      logStdout.trace(`${data.toString().trim()}`);
    });
    subprocess.stderr?.on("data", (data) => {
      logStderr.trace(`${data.toString().trim()}`);
    });

    const { stdout, stderr } = await subprocess;
    return { stdout, stderr };
  }

  async version() {
    try {
      const { stdout } = await execa({ all: true })(this.state.path().python, ["--version"]);
      return stdout;
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when checking python version");
    }
  }
}
