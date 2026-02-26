import type { State } from "#/state/state";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class UvExec extends Exec {
  constructor(public logger: Logger, public state: State) {
    super(logger, state, "uv", "uv");
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return R.succeed(result.value.stdout);
  }

  async setupVenv() {
    return await this.run(["sync", "--directory", this.state.path().pythonWorkdir], {
      env: {
        UV_PROJECT_ENVIRONMENT: this.state.path().venvDir,
      },
    });
  }
}
