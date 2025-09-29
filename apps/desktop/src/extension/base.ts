import fs from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import StreamZip from "node-stream-zip";
import { env } from "#/env";
import { log } from "#/util/logger";

export class Extension {
  name: string;
  downloadUrl: string | (() => Promise<string>);
  installingLock = false;
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

  async updateManifestPermissions({
    add = [],
    remove = [],
  }: {
    add?: string[];
    remove?: string[];
  }) {
    log.info(`Updating manifest.json for ${this.name}`);
    const manifestPath = path.join(this.getExtensionPath(), "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found for ${this.name}`);
    }

    // Read and parse
    const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRaw);

    // Ensure permissions array exists
    if (!manifest.permissions) {
      manifest.permissions = [];
    }

    // Add new permissions
    for (const p of add) {
      if (!manifest.permissions.includes(p)) {
        manifest.permissions.push(p);
      }
    }

    // Remove unwanted permissions
    if (remove.length > 0) {
      manifest.permissions = manifest.permissions.filter(
        (p: string) => !remove.includes(p),
      );
    }

    // Write back prettified JSON
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  getExtensionPath() {
    return path.join(env.USER_DATA_PATH, "extension", this.name);
  }

  getDownloadPath() {
    return path.join(env.USER_DATA_PATH, "extension", `${this.name}.zip`);
  }

  async downloadExtension() {
    log.info(`Downloading ${this.name} extension`);
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
    log.info(`Downloaded ${this.name} extension to ${downloadPath}`);
    return downloadPath;
  }

  async extractExtension() {
    log.info(`Extracting ${this.name} extension`);
    fs.mkdirSync(this.getExtensionPath(), { recursive: true });

    const zip = new StreamZip.async({ file: this.getDownloadPath() });
    try {
      const count = await zip.extract(null, this.getExtensionPath());
      log.debug(`Extracted ${count} entries to ${this.getExtensionPath()}`);
    } catch {
      log.error(
        `Failed to extract ${this.name} extension, check if ${this.getDownloadPath()} is downloaded correctly`,
      );
      return;
    } finally {
      await zip.close();
    }
    log.info(`Extracted ${this.name} extension to ${this.getExtensionPath()}`);
    return this.getExtensionPath();
  }

  isInstalled() {
    const isInstalled = fs.existsSync(
      path.join(this.getExtensionPath(), "manifest.json"),
    );
    log.info(`Extension ${this.name} is ${isInstalled ? "" : "not"} installed`);
    return isInstalled;
  }

  async install() {
    if (this.installingLock) {
      return;
    }
    this.installingLock = true;
    log.info(`Installing ${this.name} extension`);
    try {
      await this.downloadExtension();
      await this.extractExtension();
      if (this.isInstalled()) {
        log.info(`Installed ${this.name} extension`);
      } else {
        log.error(`Failed to install ${this.name} extension`);
      }
    } catch (e) {
      log.error({ error: e }, `Failed to install ${this.name} extension`);
    }

    this.installingLock = false;
  }

  async reinstall() {
    if (this.installingLock) {
      return;
    }
    this.installingLock = true;
    log.info(`Reinstalling ${this.name} extension`);

    try {
      // Remove old extracted extension folder
      const extPath = this.getExtensionPath();
      if (fs.existsSync(extPath)) {
        await rm(extPath, { recursive: true, force: true });
        log.info(`Removed old extension folder: ${extPath}`);
      }

      // Remove old zip if exists
      const zipPath = this.getDownloadPath();
      if (fs.existsSync(zipPath)) {
        await rm(zipPath, { force: true });
        log.info(`Removed old extension zip: ${zipPath}`);
      }
    } catch (e) {
      log.error({ error: e }, `Failed to reinstall ${this.name} extension`);
    }
    this.installingLock = false;
    await this.install();
  }
}
