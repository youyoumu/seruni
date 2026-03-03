import path from "node:path";

import type { State } from "#/state/state";
import {
  safeAccess,
  safeCp,
  safeMkdir,
  safeReadFile,
  safeRm,
  safeWriteFile,
} from "#/util/fs";
import { anyCatch, anyFail, safeJSONParse } from "#/util/result";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";

import { TarExec } from "../exec/tar.exec";

export class BindingService {
  constructor(
    public log: Logger,
    public state: State,
    public tar: TarExec,
  ) {
    this.log = log.child({ name: "binding" });
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
      R.inspectError((e) => {
        this.log.error(e.message);
      }),
    );
  }

  async installBinding(): Promise<R.Result<void, Error>> {
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
      R.inspectError((e) => {
        this.log.error(e.message);
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
      R.andThen(() => this.tar.extract(tempTar, targetDir)),
      R.andThen(() => {
        const nestedPath = path.join(targetDir, "build", "Release", "better_sqlite3.node");
        const finalPath = path.join(targetDir, "better_sqlite3.node");
        return safeCp(nestedPath, finalPath);
      }),
      R.andThen(() => safeRm(path.join(targetDir, "build"), { recursive: true })),
      R.andThen(() => safeRm(tempTar)),
      R.inspect(() => {
        this.log.info(`Successfully installed better-sqlite3 binding to ${targetDir}`);
      }),
      R.inspectError((e) => {
        this.log.error(e, "Failed when installing binding");
      }),
    );
  }
}
