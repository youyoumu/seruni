import type { State } from "#/state/state";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class UvExec extends Exec {
  constructor(
    public log: Logger,
    public state: State,
  ) {
    super(log, "uv", "uv");
    this.log = log.child({ name: "uv" });
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return R.succeed(result.value.stdout);
  }

  async setupVenv() {
    this.log.info("Setting up Python virtual environment");
    return await R.pipe(
      this.run(["sync", "--directory", this.state.path().pythonWorkdir], {
        env: {
          UV_PROJECT_ENVIRONMENT: this.state.path().venvDir,
        },
      }),
      R.inspectError((e) => {
        this.log.error(e, "Failed to setup Python virtual environment");
      }),
      R.inspect(() => {
        this.log.info("Successfully setup Python virtual environment");
      }),
    );
  }
}
