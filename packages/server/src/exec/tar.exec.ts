import path from "node:path";

import type { State } from "#/state/state";
import { yyyyMMdd_HHmmss } from "#/util/date";
import { safeCp, safeMkdir, safeReadDir, safeRm } from "#/util/fs";
import { anyFail } from "#/util/result";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";
import { uid } from "uid";

import { Exec } from "./Exec";

export class UpdateError extends Error {
  constructor(
    message: string,
    public backupDir: string,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = "UpdateError";
  }
}

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

  async restoreInstallation(backupDir: string): Promise<R.Result<void, Error>> {
    const path_ = this.state.path();
    const items = await safeReadDir(backupDir);
    if (R.isFailure(items)) return anyFail("Failed to read backup directory", items.error);

    for (const item of items.value) {
      const src = path.join(backupDir, item);
      const dest = path.join(path_.installationDir, item);
      const result = await safeCp(src, dest, { recursive: true });
      if (R.isFailure(result)) return anyFail(`Failed to restore ${item}`, result.error);
    }

    return R.succeed();
  }

  async removeInstallation(): Promise<R.Result<string, Error>> {
    const path_ = this.state.path();
    const toDelete = [
      path_.packageJson,
      path_.entry,
      path_.libDir,
      path_.pythonWorkdir,
      path_.drizzleDir,
      path_.webuiDir,
    ];

    const backupDirName = `seruni-old-${yyyyMMdd_HHmmss(new Date())}_${uid()}`;
    const backupDir = path.join(path_.trashDir, backupDirName);

    const mkdirResult = await safeMkdir(backupDir, { recursive: true });
    if (R.isFailure(mkdirResult)) return anyFail("Failed to create backup directory", mkdirResult.error);

    for (const path__ of toDelete) {
      const newPath = path.join(backupDir, path.basename(path__));
      const result = await safeCp(path__, newPath, { recursive: true });
      if (R.isFailure(result)) return anyFail(`Failed to backup ${path__}`, result.error);
    }

    for (const path__ of toDelete) {
      const result = await safeRm(path__, { recursive: true });
      if (R.isFailure(result)) {
        return R.fail(new UpdateError(`Failed to delete ${path__}`, backupDir, result.error));
      }
    }

    return R.succeed(backupDir);
  }

  async install(tarFilePath?: string): Promise<R.Result<void, Error>> {
    const installationDir = this.state.path().installationDir;

    let targetPath = tarFilePath;
    if (!targetPath) {
      const result = await safeReadDir(installationDir);
      if (R.isFailure(result))
        return anyFail("Failed to read installation directory", result.error);

      const tarFile = result.value.find((f) => /^seruni-v\d+\.\d+\.\d+\.tar\.gz$/.test(f));
      if (!tarFile) return anyFail("No seruni-v<version>.tar.gz found in installation directory");
      targetPath = path.join(installationDir, tarFile);
    }

    const extractResult = await this.run(["-xzf", targetPath, "-C", installationDir]);
    if (R.isFailure(extractResult))
      return anyFail("Failed to extract tarball", extractResult.error);

    return R.succeed();
  }

  async update(tarFilePath?: string): Promise<R.Result<void, Error>> {
    const removeResult = await this.removeInstallation();
    if (R.isFailure(removeResult)) {
      const err = removeResult.error;
      if (err instanceof UpdateError) {
        const restoreResult = await this.restoreInstallation(err.backupDir);
        if (R.isFailure(restoreResult)) {
          this.log.error(restoreResult.error, "Installation may be broken after failed removal");
        }
      }
      return anyFail("Failed to remove installation", err);
    }

    const installResult = await this.install(tarFilePath);
    if (R.isFailure(installResult)) {
      const restoreResult = await this.restoreInstallation(removeResult.value);
      if (R.isFailure(restoreResult)) {
        this.log.error(restoreResult.error, "Installation may be broken after failed install");
      }
      return anyFail("Failed to install update", installResult.error);
    }

    return R.succeed();
  }
}
