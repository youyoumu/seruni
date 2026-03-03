import path from "node:path";

import type { State } from "#/state/state";
import { yyyyMMdd_HHmmss } from "#/util/date";
import { safeCp, safeMkdir, safeReadDir, safeRm } from "#/util/fs";
import { anyFail } from "#/util/result";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";
import { uid } from "uid";

import { TarExec } from "../exec/tar.exec";

export class UpdateError extends Error {
  backupDir: string;
  constructor(message: string, options: { backupDir: string; cause?: Error }) {
    super(message, { cause: options.cause });
    this.name = "UpdateError";
    this.backupDir = options.backupDir;
  }
}

export class UpdateService {
  constructor(
    public log: Logger,
    public state: State,
    public tar: TarExec,
  ) {
    this.log = log.child({ name: "update" });
  }

  async restoreInstallation(backupDir: string): Promise<R.Result<void, Error>> {
    const path_ = this.state.path();
    return R.pipe(
      safeReadDir(backupDir),
      R.andThen(async (items) => {
        for (const item of items) {
          const src = path.join(backupDir, item);
          const dest = path.join(path_.entryDir, item);
          const result = await safeCp(src, dest, { recursive: true });
          if (R.isFailure(result)) {
            return anyFail(`Failed to restore ${item}`, result.error);
          }
        }
        return R.succeed();
      }),
      R.inspectError((e) => {
        this.log.error(e, "Failed to restore installation");
        this.log.warn("Installation may be broken.");
        return e;
      }),
    );
  }

  async removeInstallation(): Promise<R.Result<string, Error | UpdateError>> {
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
    if (R.isFailure(mkdirResult))
      return anyFail("Failed to create backup directory", mkdirResult.error);

    for (const path__ of toDelete) {
      const newPath = path.join(backupDir, path.basename(path__));
      const result = await safeCp(path__, newPath, { recursive: true });
      if (R.isFailure(result)) return anyFail(`Failed to backup ${path__}`, result.error);
    }

    for (const path__ of toDelete) {
      const result = await safeRm(path__, { recursive: true });
      if (R.isFailure(result)) {
        return R.fail(
          new UpdateError(`Failed to delete ${path__}`, { backupDir, cause: result.error }),
        );
      }
    }

    return R.succeed(backupDir);
  }

  async update(tarFilePath: string): Promise<R.Result<void, Error>> {
    const path_ = this.state.path();
    const entryDir = path_.entryDir;

    return await R.pipe(
      R.do(),
      R.bind("targetPath", async () => {
        if (tarFilePath) return R.succeed(tarFilePath);
        const result = await safeReadDir(entryDir);
        if (R.isFailure(result)) return anyFail("Failed to read entry directory", result.error);
        const tarFile = result.value.find((f) => /^seruni-v\d+\.\d+\.\d+\.tar\.gz$/.test(f));
        if (!tarFile) return anyFail("No seruni-v<version>.tar.gz found in entry directory");
        return R.succeed(path.join(entryDir, tarFile));
      }),

      R.andThrough(({ targetPath }) => this.tar.checkIntegrity(targetPath, ["package.json", "main.mjs"])),
      R.bind("backupDir", () => this.removeInstallation()),

      R.andThen(async ({ targetPath, backupDir }) => {
        const result = await this.tar.extract(targetPath, entryDir);
        if (R.isFailure(result)) {
          return R.fail(
            new UpdateError("Failed to install update", { backupDir, cause: result.error }),
          );
        }
        return R.succeed();
      }),

      R.inspectError(async (e) => {
        this.log.error(e, "Failed to update");
        if (e instanceof UpdateError) {
          this.log.info("Restoring installation");
          await this.restoreInstallation(e.backupDir);
        }
      }),
      R.inspect(() => {
        this.log.info("Update completed successfully");
      }),
    );
  }
}
