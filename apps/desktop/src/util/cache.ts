import { createWriteStream } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format } from "date-fns";
import { throttle } from "es-toolkit";
import z from "zod";
import { env } from "#/env";
import { log } from "./logger";

const zCacheData = z.array(
  z.object({
    downloadUrl: z.string(),
    downloadedFilePath: z.string(),
  }),
);

export type CacheData = z.infer<typeof zCacheData>;

class Cache {
  constructor() {
    this.readCacheFile();
  }

  async readCacheFile() {
    let cacheData: CacheData = [];
    try {
      const data = await readFile(env.CACHE_FILE_PATH, "utf8");
      const cacheData_ = JSON.parse(data);
      cacheData = zCacheData.parse(cacheData_);
    } catch {
      log.warn(`Failed to parse ${env.CACHE_FILE_PATH}`);
      await this.writeCacheFile(cacheData);
    }
    return cacheData;
  }

  async writeCacheFile(cacheData: CacheData) {
    await writeFile(
      env.CACHE_FILE_PATH,
      JSON.stringify(cacheData, null, 2),
      "utf8",
    );
  }

  async setDownloadCache({
    downloadUrl,
    downloadedFilePath,
  }: CacheData[number]) {
    const cacheData = await this.readCacheFile();
    await this.writeCacheFile([
      ...cacheData,
      {
        downloadUrl,
        downloadedFilePath,
      },
    ]);
  }

  async getDownloadCache(downloadUrl: string) {
    const cacheData = await this.readCacheFile();
    const downloadedFilePath = cacheData.find(
      (item) => item.downloadUrl === downloadUrl,
    )?.downloadedFilePath;
    let exists = false;
    if (downloadedFilePath) {
      await access(downloadedFilePath).then(() => {
        exists = true;
        log.debug(
          {
            downloadUrl,
            downloadedFilePath,
          },
          "Cache hit",
        );
      });
    }
    return exists ? downloadedFilePath : undefined;
  }

  async download({
    downloadUrl,
    fileName,
    fallbackFileName,
  }: {
    downloadUrl: string;
    fileName?: string;
    fallbackFileName?: string;
  }) {
    const downloadedFilePath = await this.getDownloadCache(downloadUrl);
    if (downloadedFilePath) return downloadedFilePath;

    const res = await fetch(downloadUrl);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download ${downloadUrl}: ${res.statusText}`);
    }

    if (!fileName) {
      const disposition = res.headers.get("content-disposition");
      if (disposition?.includes("filename=")) {
        const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"']+)/i);
        if (match) fileName = decodeURIComponent(match[1] ?? "");
      }
    }

    const total = Number(res.headers.get("content-length"));
    const destPath = join(
      env.CACHE_PATH,
      fileName ??
        fallbackFileName ??
        `${format(new Date(), "yyyyMMdd-HHmmss")}.tmp`,
    );
    const fileStream = createWriteStream(destPath);

    let downloaded = 0;
    const reader = res.body.getReader();

    log.info(
      `File size: ${total ? `${(total / 1024 / 1024).toFixed(2)} MB` : "unknown"}`,
    );

    const logDownloadProgress = throttle(() => {
      if (total) {
        const percent = ((downloaded / total) * 100).toFixed(1);
        log.info(
          `Downloading ${fileName}... ${Math.round(downloaded / 1024)} KB -- ${percent}%`,
        );
      } else {
        log.info(`Downloaded ${Math.round(downloaded / 1024)} KB...`);
      }
    }, 500);

    // Stream reading
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
      downloaded += value.length;
      logDownloadProgress();
    }

    fileStream.end();
    log.info(`Downloaded ${fileName} successfully to ${destPath}`);

    await this.setDownloadCache({
      downloadUrl,
      downloadedFilePath: destPath,
    });

    return destPath;
  }
}

export const cache = new Cache();
