import path from "node:path";

import type { State } from "#/state/state";
import { yyyyMMdd_HHmmss } from "#/util/date";
import { safeCp, safeReadDir, safeRm } from "#/util/fs";
import { R } from "@praha/byethrow";
import { anyFail } from "#/util/result";
import type { Logger } from "pino";
import { uid } from "uid";

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
    if (R.isFailure(result)) return anyFail("Failed to get tar version", result.error);
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
    const dir = `seruni-old-${yyyyMMdd_HHmmss(new Date())}_${uid()}`;
    for (const path_ of toDelete) {
      const newPath = path.join(this.state.path().trashDir, dir, path.basename(path_));
      const result = await safeCp(path_, newPath, { recursive: true });
      if (R.isFailure(result))
        return this.log.error(result.error, `Error when copying ${path_} to ${newPath}`);
    }

    for (const path of toDelete) {
      const result = await safeRm(path, { recursive: true });
      if (R.isFailure(result)) return this.log.error(result.error, `Error when deleting ${path}`);
    }
  }

  async install(tarFilePath?: string): Promise<R.Result<void, Error>> {
    const installationDir = this.state.path().installationDir;

    let targetPath = tarFilePath;
    if (!targetPath) {
      const result = await safeReadDir(installationDir);
      if (R.isFailure(result)) return anyFail("Failed to read installation directory", result.error);

      const tarFile = result.value.find((f) => /^seruni-v\d+\.\d+\.\d+\.tar\.gz$/.test(f));
      if (!tarFile) return anyFail("No seruni-v<version>.tar.gz found in installation directory");
      targetPath = path.join(installationDir, tarFile);
    }

    const extractResult = await this.run(["-xzf", targetPath, "-C", installationDir]);
    if (R.isFailure(extractResult)) return anyFail("Failed to extract tarball", extractResult.error);

    return R.succeed();
  }

  async update(tarFilePath?: string): Promise<R.Result<void, Error>> {
    await this.removeInstallation();
    return this.install(tarFilePath);
  }
}
