import fs from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import StreamZip from "node-stream-zip";
import { env } from "#/env";
import { log } from "#/util/logger";

export class Extension {
  name: string;
  downloadUrl: string | (() => Promise<string>);
  constructor(options: {
    name: string;
    downloadUrl: string | (() => Promise<string>);
  }) {
    this.name = options.name;
    this.downloadUrl = options.downloadUrl;
  }

  static shimFile(targetPath: string, shimPath: string) {
    // Read shim file
    const shim = fs.readFileSync(shimPath, "utf-8");
    // Read original file
    const original = fs.readFileSync(targetPath, "utf-8");
    // Prepend shim + original
    const combined = `${shim}\n${original}`;
    // Overwrite target file
    fs.writeFileSync(targetPath, combined, "utf-8");
  }

  getExtensionPath() {
    return path.join(env.USER_DATA_PATH, "extension", this.name);
  }

  getDownloadPath() {
    return path.join(env.USER_DATA_PATH, "extension", `${this.name}.zip`);
  }

  async downloadExtension() {
    const downloadPath = this.getDownloadPath();
    fs.mkdirSync(this.getExtensionPath(), { recursive: true });
    const downloadUrl =
      this.downloadUrl instanceof Function
        ? await this.downloadUrl()
        : this.downloadUrl;

    const res = await fetch(downloadUrl);
    if (!res.ok) {
      log.error(`Failed to download ${this.name} extension: ${res.statusText}`);
      return;
    }

    await writeFile(downloadPath, Readable.fromWeb(res.body as ReadableStream));
    return downloadPath;
  }

  async extractExtension() {
    fs.mkdirSync(this.getExtensionPath(), { recursive: true });

    const zip = new StreamZip.async({ file: this.getDownloadPath() });
    try {
      const count = await zip.extract(null, this.getExtensionPath());
      log.info(`Extracted ${count} entries to ${this.getExtensionPath()}`);
    } catch {
      log.error(
        `Failed to extract ${this.name} extension, check if ${this.getDownloadPath()} is downloaded correctly`,
      );
      return;
    } finally {
      await zip.close();
    }
    return this.getExtensionPath();
  }

  isInstalled() {
    return fs.existsSync(path.join(this.getExtensionPath(), "manifest.json"));
  }

  async install() {
    await this.downloadExtension();
    await this.extractExtension();
  }
}
