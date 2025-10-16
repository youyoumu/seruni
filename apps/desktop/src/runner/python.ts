import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { throttle } from "es-toolkit";
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

    const res = await fetch(downloadUrl);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download ${downloadUrl}: ${res.statusText}`);
    }

    const total = Number(res.headers.get("content-length"));
    const destPath = join(env.CACHE_PATH, fileName);
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

    await cache.setDownloadCache({
      downloadUrl,
      downloadedFilePath: destPath,
    });

    return destPath;
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

  async isPythonInstalled() {
    try {
      await access(env.PYTHON_BIN_PATH);
      return true;
    } catch {
      return false;
    }
  }
}

export const python = new Python();

//  ───────────────────────────────── HMR ─────────────────────────────────

type Self = typeof import("./python");
const module: Self = { python };
if (import.meta.hot) {
  hmr.register<Self>(import.meta, module);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
  });
}
