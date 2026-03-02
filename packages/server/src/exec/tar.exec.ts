import type { State } from "#/state/state";
import { safeRm } from "#/util/fs";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class TarExec extends Exec {
  constructor(
    public log: Logger,
    public state: State,
  ) {
    super(log, "tar", "tar");
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return R.succeed(result.value.stdout.split("\n")[0] ?? "");
  }

  async removeInstallation() {
    const toDelete = [
      this.state.path().packageJson,
      this.state.path().entry,
      this.state.path().libDir,
      this.state.path().pythonWorkdir,
      this.state.path().drizzleDir,
      this.state.path().webuiDir,
    ];
    for (const path of toDelete) {
      const result = await safeRm(path, { recursive: true });
      if (R.isFailure(result)) return this.log.error(result.error, `Error when deleting ${path}`);
    }
  }
}
