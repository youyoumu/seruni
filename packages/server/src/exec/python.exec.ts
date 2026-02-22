import type { State } from "#/state/state";
import { zVadData } from "#/util/schema";
import type { Logger } from "pino";

import { Exec } from "./Exec";

type SileroCommand = ["silero", string];
type HealthcheckCommand = ["healthcheck"];
type HealthcheckVenvCommand = ["healthcheck_venv"];
type PipListCommand = ["pip_list"];
type MainCommand = SileroCommand | HealthcheckCommand | HealthcheckVenvCommand | PipListCommand;

export class PythonExec extends Exec {
  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      name: "python",
      logger,
      state,
      bin: state.path().python,
    });
  }

  async runMain(command: MainCommand) {
    return await this.run([this.state.path().pythonEntry, ...command]);
  }

  async version() {
    try {
      const { stdout } = await this.run(["--version"]);
      return stdout;
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when checking python version");
    }
  }

  async runSilero(filePath: string) {
    try {
      return zVadData
        .parse(JSON.parse((await this.runMain(["silero", filePath])).stdout))
        .map((item) => {
          item.start = item.start * 1000;
          item.end = item.end * 1000;
          return item;
        });
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when running silero");
    }
  }

  async runMainHealthcheck() {
    return JSON.parse((await this.runMain(["healthcheck_venv"])).stdout);
  }

  async runHealthcheck() {
    return JSON.parse((await this.runMain(["healthcheck"])).stdout);
  }
}
