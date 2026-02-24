import type { State } from "#/state/state";
import { err, ok, Result } from "neverthrow";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class UvExec extends Exec {
  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      name: "uv",
      logger,
      state,
      bin: "uv",
    });
  }

  async version(): Promise<Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (result.isErr()) return err(result.error);
    return ok(result.value.stdout);
  }
}
