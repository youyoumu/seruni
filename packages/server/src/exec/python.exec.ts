import type { State } from "#/state/state";
import { zVadData, type VadData } from "#/util/schema";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { Exec } from "./Exec";

type SileroCommand = ["silero", string];
type HealthcheckCommand = ["healthcheck"];
type HealthcheckVenvCommand = ["healthcheck_venv"];
type PipListCommand = ["pip_list"];
type EntryCommand = SileroCommand | HealthcheckCommand | HealthcheckVenvCommand | PipListCommand;

export class PythonExec extends Exec {
  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      name: "python",
      logger,
      state,
      bin: state.path().python,
    });
  }

  async runEntry(command: EntryCommand) {
    return await this.run([this.state.path().pythonEntry, ...command]);
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return R.succeed(result.value.stdout);
  }

  async runSilero(filePath: string): Promise<R.Result<VadData, Error>> {
    const result = await this.runEntry(["silero", filePath]);
    if (R.isFailure(result)) return R.fail(result.error);
    const { stdout } = result.value;
    const vadData = zVadData.parse(JSON.parse(stdout)).map((item) => {
      item.start = item.start * 1000;
      item.end = item.end * 1000;
      return item;
    });
    return R.succeed(vadData);
  }

  async runMainHealthcheck() {
    const result = await this.runEntry(["healthcheck_venv"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return JSON.parse(result.value.stdout);
  }

  async runHealthcheck() {
    const result = await this.run(["healthcheck"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return JSON.parse(result.value.stdout);
  }
}
