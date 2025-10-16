import fs from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import StreamZip from "node-stream-zip";
import { env } from "#/env";
import { cache } from "#/util/cache";
import { log } from "#/util/logger";

hmr.log(import.meta);

export class Extension {
  name: string;
  downloadUrl: string | (() => Promise<string>);
  installingLock = false;
  fileName: string;
  constructor(options: {
    name: string;
    downloadUrl: string | (() => Promise<string>);
  }) {
    this.name = options.name;
    this.fileName = `${this.name}.zip`;
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

  static async deleteSeriveWorkerDir() {
    const swDir = path.join(env.ELECTRON_PATH, "Service Worker");
    await rm(swDir, { recursive: true, force: true });
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
    return path.join(env.EXTENSION_PATH, this.name);
  }

  async downloadExtension() {
    log.info(`Downloading ${this.name} extension`);
    await mkdir(this.getExtensionPath(), { recursive: true });
    const downloadUrl =
      typeof this.downloadUrl === "string"
        ? this.downloadUrl
        : await this.downloadUrl();
    const downloadedFilePath = await cache.getDownloadCache(downloadUrl);
    if (downloadedFilePath) return downloadedFilePath;

    const res = await fetch(downloadUrl);
    if (!res.ok) {
      log.error(`Failed to download ${this.name} extension: ${res.statusText}`);
      return;
    }
    const disposition = res.headers.get("content-disposition");
    if (disposition?.includes("filename=")) {
      const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"']+)/i);
      if (match) this.fileName = decodeURIComponent(match[1] ?? this.fileName);
    }

    const downloadPath = path.join(env.CACHE_PATH, this.fileName);
    await writeFile(downloadPath, Readable.fromWeb(res.body as ReadableStream));
    log.info(`Downloaded ${this.name} extension to ${downloadPath}`);
    await cache.setDownloadCache({
      downloadUrl,
      downloadedFilePath: downloadPath,
    });
    return downloadPath;
  }

  async extractExtension({ filePath }: { filePath: string }) {
    log.info(`Extracting ${this.name} extension`);
    await mkdir(this.getExtensionPath(), { recursive: true });

    const zip = new StreamZip.async({ file: filePath });
    try {
      const count = await zip.extract(null, this.getExtensionPath());
      log.debug(`Extracted ${count} entries to ${this.getExtensionPath()}`);
    } catch {
      log.error(
        `Failed to extract ${this.name} extension, check if ${filePath} is downloaded correctly`,
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
    return isInstalled;
  }

  async install() {
    if (this.installingLock) {
      return;
    }
    this.installingLock = true;
    log.info(`Installing ${this.name} extension`);
    //TODO: call this with a button for debugging
    // await Extension.deleteSeriveWorkerDir();
    try {
      const filePath = await this.downloadExtension();
      if (!filePath) throw new Error("Failed to download extension");
      await this.extractExtension({ filePath });
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

    // Remove old extracted extension folder
    const extPath = this.getExtensionPath();
    await rm(extPath, { recursive: true, force: true });
    log.info(`Removed old extension folder: ${extPath}`);

    this.installingLock = false;
    await this.install();
  }
}
