import type { State } from "#/state/state";
import { safeAccess } from "#/util/fs";
import { anyFail } from "#/util/result";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class TarExec extends Exec {
  constructor(
    public log: Logger,
    public state: State,
  ) {
    super(log, "tar", "tar");
    this.log = log.child({ name: "tar" });
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (R.isFailure(result)) return anyFail("Failed to get tar version", result.error);
    return R.succeed(result.value.stdout.split("\n")[0] ?? "");
  }

  async checkIntegrity(tarFilePath: string, requiredFiles?: string[]): Promise<R.Result<void, Error>> {
    const exists = await safeAccess(tarFilePath);
    if (R.isFailure(exists)) return anyFail("Tar file not found", exists.error);

    const extractResult = await this.run(["-tzf", tarFilePath]);
    if (R.isFailure(extractResult))
      return anyFail("Tar file is corrupted or invalid", extractResult.error);

    if (requiredFiles && requiredFiles.length > 0) {
      const contents = extractResult.value.stdout.split("\n").filter(Boolean);
      const missing = requiredFiles.filter((f) => !contents.some((c) => c.startsWith(f)));
      if (missing.length > 0) {
        return anyFail(`Tar missing required files: ${missing.join(", ")}`);
      }
    }

    return R.succeed();
  }

  async extract(tarFilePath: string, targetDir: string): Promise<R.Result<void, Error>> {
    const extractResult = await this.run(["-xzf", tarFilePath, "-C", targetDir]);
    if (R.isFailure(extractResult))
      return anyFail("Failed to extract tarball", extractResult.error);

    return R.succeed();
  }
}
