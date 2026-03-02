import path from "node:path";

import type { State } from "#/state/state";
import { yyyyMMdd_HHmmss } from "#/util/date";
import {
  safeAccess,
  safeCp,
  safeMkdir,
  safeReadDir,
  safeReadFile,
  safeRm,
  safeWriteFile,
} from "#/util/fs";
import { anyCatch, anyFail, safeJSONParse } from "#/util/result";
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
    this.log = log.child({ name: "tar" });
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["--version"]);
    if (R.isFailure(result)) return anyFail("Failed to get tar version", result.error);
    return R.succeed(result.value.stdout.split("\n")[0] ?? "");
  }

  async getBinding() {
    return R.pipe(
      R.do(),
      R.bind("platform", () => {
        const platform = process.platform;
        if (["win32", "darwin", "linux"].includes(platform)) return R.succeed(platform);
        return anyFail(`Unsupported platform: ${platform}`);
      }),
      R.bind("arch", () => {
        const arch = process.arch;
        if (["x64", "arm64"].includes(arch)) return R.succeed(arch);
        return anyFail(`Unsupported architecture: ${arch}`);
      }),
      R.bind("abi", () => {
        const abi = process.versions.modules;
        const supportedAbis = ["115", "127", "131", "137", "141"];
        if (supportedAbis.includes(abi)) return R.succeed(abi);
        return anyFail(`Unsupported abi: ${abi}`);
      }),
      R.map(({ platform, arch, abi }) => {
        const path_ = this.state.path();
        const bindingName = `node-v${abi}-${platform}-${arch}`;
        const targetDir = path.join(path_.libDir, "binding", bindingName);
        const target = path.join(targetDir, "better_sqlite3.node");
        return { platform, arch, abi, bindingName, targetDir, target };
      }),
      R.andThen(async (attr) => {
        const exists = await safeAccess(attr.target);
        return R.succeed({
          ...attr,
          exists: R.isSuccess(exists),
        });
      }),
    );
  }

  async downloadBinding(): Promise<R.Result<void, Error>> {
    const path_ = this.state.path();
    const binding = await this.getBinding();
    if (R.isFailure(binding)) return binding;
    const { bindingName, targetDir, exists } = binding.value;
    if (exists) {
      this.log.info(`Binding already exists at ${targetDir}`);
      return R.succeed();
    }

    const urlResult = await R.pipe(
      R.do(),
      R.bind("packageJson", () => safeReadFile(path_.packageJson, "utf-8")),
      R.bind("parsed", ({ packageJson }) => safeJSONParse(packageJson)),
      R.bind("version", ({ parsed }) => {
        const version = (parsed as { dependencies?: Record<string, string> })?.dependencies?.[
          "better-sqlite3"
        ]?.replace(/^\^/, "");
        if (!version) return anyFail("better-sqlite3 not found in dependencies");
        return R.succeed(version);
      }),
      R.map((attr) => {
        const { version } = attr;
        const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/better-sqlite3-v${version}-${bindingName}.tar.gz`;
        const tempTar = path.join(path_.tempDir, `better-sqlite3-${bindingName}.tar.gz`);
        return { ...attr, url, tempTar };
      }),
    );
    if (R.isFailure(urlResult)) return urlResult;
    const { url, tempTar } = urlResult.value;

    return R.pipe(
      R.try({
        try: async () => {
          this.log.info(`Downloading better-sqlite3 binding from ${url}`);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        },
        catch: anyCatch("Failed to download binding"),
      }),
      R.andThen((buffer) => safeWriteFile(tempTar, buffer)),
      R.andThen(() => safeMkdir(targetDir, { recursive: true })),
      R.andThen(() => this.run(["-xzf", tempTar, "-C", targetDir])),
      R.andThen(() => {
        const nestedPath = path.join(targetDir, "build", "Release", "better_sqlite3.node");
        const finalPath = path.join(targetDir, "better_sqlite3.node");
        return safeCp(nestedPath, finalPath);
      }),
      R.andThen(() => safeRm(path.join(targetDir, "build"), { recursive: true })),
      R.andThen(() => safeRm(tempTar)),
      R.map(() => {
        this.log.info(`Successfully installed better-sqlite3 binding to ${targetDir}`);
      }),
    );
  }

  async restoreInstallation(backupDir: string): Promise<R.Result<void, Error>> {
    const path_ = this.state.path();
    const items = await safeReadDir(backupDir);
    if (R.isFailure(items)) return anyFail("Failed to read backup directory", items.error);

    for (const item of items.value) {
      const src = path.join(backupDir, item);
      const dest = path.join(path_.entryDir, item);
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
        return R.fail(new UpdateError(`Failed to delete ${path__}`, backupDir, result.error));
      }
    }

    return R.succeed(backupDir);
  }

  async checkIntegrity(tarFilePath: string): Promise<R.Result<void, Error>> {
    const result = await safeReadDir(path.dirname(tarFilePath));
    if (R.isFailure(result)) return anyFail("Failed to read tar file directory", result.error);

    const fileName = path.basename(tarFilePath);
    if (!result.value.includes(fileName)) {
      return anyFail(`Tar file not found: ${tarFilePath}`);
    }

    const extractResult = await this.run(["-tzf", tarFilePath]);
    if (R.isFailure(extractResult))
      return anyFail("Tar file is corrupted or invalid", extractResult.error);

    return R.succeed();
  }

  async install(tarFilePath: string): Promise<R.Result<void, Error>> {
    const entryDir = this.state.path().entryDir;

    const extractResult = await this.run(["-xzf", tarFilePath, "-C", entryDir]);
    if (R.isFailure(extractResult))
      return anyFail("Failed to extract tarball", extractResult.error);

    return R.succeed();
  }

  async update(tarFilePath?: string): Promise<R.Result<void, Error>> {
    const entryDir = this.state.path().entryDir;

    let targetPath = tarFilePath;
    if (!targetPath) {
      const result = await safeReadDir(entryDir);
      if (R.isFailure(result)) return anyFail("Failed to read entry directory", result.error);

      const tarFile = result.value.find((f) => /^seruni-v\d+\.\d+\.\d+\.tar\.gz$/.test(f));
      if (!tarFile) return anyFail("No seruni-v<version>.tar.gz found in entry directory");
      targetPath = path.join(entryDir, tarFile);
    }

    const integrityResult = await this.checkIntegrity(targetPath);
    if (R.isFailure(integrityResult))
      return anyFail("Update failed: tar file check failed", integrityResult.error);

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

    const installResult = await this.install(targetPath);
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
