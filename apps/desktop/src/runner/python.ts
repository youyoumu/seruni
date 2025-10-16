import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import * as tar from "tar";
import { env } from "#/env";
import { cache } from "#/util/cache";
import { log } from "#/util/logger";

hmr.log(import.meta);

class Python {
  async run(params: string[]) {
    const finalParams = [...params];
    const { stdout, stderr } = await execa(env.PYTHON_BIN_PATH, finalParams);

    log.trace(
      {
        params: finalParams,
        stdout,
        stderr,
      },
      "python",
    );
    return stdout;
  }

  async runEntry(params: string[]) {
    const finalParams = [env.PYTHON_ENTRY_PATH, ...params];
    const { stdout, stderr } = await execa(env.PYTHON_BIN_PATH, finalParams);

    log.trace(
      {
        params: finalParams,
        stdout,
        stderr,
      },
      "python",
    );
    return stdout;
  }

  async download() {
    const pythonDownloadUrl: Partial<Record<NodeJS.Platform, string>> = {
      win32:
        "https://github.com/astral-sh/python-build-standalone/releases/download/20251007/cpython-3.13.8+20251007-x86_64-pc-windows-msvc-install_only_stripped.tar.gz",
      linux:
        "https://github.com/astral-sh/python-build-standalone/releases/download/20251007/cpython-3.13.8+20251007-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz",
    };

    const downloadUrl = pythonDownloadUrl[process.platform];
    if (!downloadUrl) {
      throw new Error(`No download url found for platform ${process.platform}`);
    }
    const downloadedFilePath = await cache.getDownloadCache(downloadUrl);
    if (downloadedFilePath) return downloadedFilePath;
    const fileName = downloadUrl.split("/").pop() ?? "python.tar.gz";
    log.info(`Downloading ${fileName} from ${downloadUrl}`);

    const assetRes = await fetch(downloadUrl);
    const buffer = await assetRes.arrayBuffer();
    const downloadPath = join(env.CACHE_PATH, fileName);
    await writeFile(downloadPath, Buffer.from(buffer));

    log.info(`Downloaded ${downloadPath} successfully!`);
    await cache.setDownloadCache({
      downloadUrl,
      downloadedFilePath: downloadPath,
    });

    return downloadPath;
  }

  async extract({ tarPath }: { tarPath: string }) {
    log.info(`Extracting ${tarPath}`);
    await mkdir(env.PYTHON_EXTRACT_PATH, { recursive: true });

    try {
      await tar.x({
        file: tarPath,
        cwd: env.PYTHON_EXTRACT_PATH,
        strict: true, // throw errors on bad entries
      });

      log.info(`Extracted ${tarPath} to ${env.PYTHON_EXTRACT_PATH}`);
      return env.PYTHON_EXTRACT_PATH;
    } catch (err) {
      log.error({ error: err }, `Failed to extract ${tarPath}`);
      throw err;
    }
  }

  async installDeps() {
    await this.run(["-m", "pip", "install", "uv"]);
    await this.run(["-m", "uv", "pip", "install", env.PYTHON_PACKAGE_PATH]);
  }
}

export const python = new Python();
