import { access, readFile, writeFile } from "node:fs/promises";
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
        log.debug(`Cached file ${downloadedFilePath} exists`);
      });
    }
    return exists ? downloadedFilePath : undefined;
  }
}

export const cache = new Cache();
