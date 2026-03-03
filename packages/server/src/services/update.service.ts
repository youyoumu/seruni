import path from "node:path";

import type { State } from "#/state/state";
import { fmt } from "#/util/date";
import { safeCp, safeMkdir, safeMv, safeMvBatch, safeReadDir, safeReadFile } from "#/util/fs";
import { anyFail, safeJSONParse, verifySignature } from "#/util/result";
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

    const backupDirName = `seruni.old-${fmt["yyyyMMdd-HHmmss"]()}-${uid()}`;
    const backupDir = path.join(path_.trashDir, backupDirName);

    const mkdirResult = await safeMkdir(backupDir, { recursive: true });
    if (R.isFailure(mkdirResult))
      return anyFail("Failed to create backup directory", mkdirResult.error);

    const toMove = toDelete.map((path_) => ({
      source: path_,
      destination: path.join(backupDir, path.basename(path_)),
    }));
    const moveResult = await safeMvBatch(toMove);

    if (R.isFailure(moveResult))
      return R.fail(
        new UpdateError("Failed to backup old installation", {
          backupDir,
          cause: moveResult.error,
        }),
      );

    return R.succeed(backupDir);
  }

  async getTarFileFromDataDir() {
    const dataDir = this.state.path().dataDir;
    const result = await safeReadDir(dataDir);
    if (R.isFailure(result)) return anyFail("Failed to read data directory", result.error);
    const tarFile = result.value.find((f) => /^seruni-v\d+\.\d+\.\d+\.tar\.gz$/.test(f));
    if (!tarFile) return anyFail("No seruni-v<version>.tar.gz found in data directory");
    return R.succeed(path.join(dataDir, tarFile));
  }

  async update(tarFilePath?: string) {
    return await R.pipe(
      R.do(),
      R.bind("targetPath", async () => {
        if (tarFilePath) return R.succeed(tarFilePath);
        return this.getTarFileFromDataDir();
      }),
      R.map((attr) => {
        const manifestPath = attr.targetPath.replace(/\.tar\.gz$/, ".manifest.json");
        return { ...attr, manifestPath };
      }),
      R.bind("manifestString", ({ manifestPath }) => safeReadFile(manifestPath, "utf-8")),
      R.bind("manifest", ({ manifestString }) =>
        safeJSONParse<Record<string, unknown>>(manifestString),
      ),

      R.bind("hash", async ({ manifest }) => {
        if (typeof manifest !== "object") return anyFail("Manifest is not an object");
        const hash = manifest?.hash;
        if (typeof hash !== "string") return anyFail("Hash is not a string");
        if (!hash) return anyFail("Hash not found in manifest");
        return R.succeed(hash);
      }),
      R.bind("signature", async ({ manifest }) => {
        if (typeof manifest !== "object") return anyFail("Manifest is not an object");
        const signature = manifest?.signature;
        if (typeof signature !== "string") return anyFail("Signature is not a string");
        if (!signature) return anyFail("Signature not found in manifest");
        return R.succeed(signature);
      }),
      R.andThrough(({ hash, signature }) => {
        return verifySignature(hash, signature);
      }),

      R.andThrough(({ targetPath, hash }) => {
        return this.tar.checkIntegrity(targetPath, ["./package.json", "./main.mjs"], hash);
      }),
      R.bind("backupDir", () => this.removeInstallation()),

      R.andThrough(async ({ targetPath, backupDir }) => {
        const result = await this.tar.extract(targetPath, this.state.path().entryDir);
        if (R.isFailure(result)) {
          return R.fail(
            new UpdateError("Failed to install update", { backupDir, cause: result.error }),
          );
        }
        return R.succeed();
      }),
      R.map((attr) => {
        const parentDir = path.dirname(attr.targetPath);
        const trashDir = path.join(
          this.state.path().trashDir,
          `${path.basename(attr.targetPath)}-${fmt["yyyyMMdd-HHmmss"]()}-${uid()}`,
        );
        return { ...attr, parentDir, trashDir };
      }),

      R.andThrough(async ({ manifestPath, targetPath, parentDir, trashDir }) => {
        if (parentDir === this.state.path().entryDir) {
          return await R.collect([
            safeMv(manifestPath, path.join(trashDir, path.basename(manifestPath))),
            safeMv(targetPath, path.join(trashDir, path.basename(targetPath))),
          ]);
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
