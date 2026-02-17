import type { State } from "#/state/state";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class PythonExec extends Exec {
  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      name: "python",
      logger,
      state,
      bin: state.path().python,
    });
  }

  async version() {
    try {
      const { stdout } = await this.run(["--version"]);
      return stdout;
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when checking python version");
    }
  }
}
