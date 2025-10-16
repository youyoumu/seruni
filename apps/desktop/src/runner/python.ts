import { access, mkdir } from "node:fs/promises";
import { execa } from "execa";
import * as tar from "tar";
import { env } from "#/env";
import { cache } from "#/util/cache";
import { log } from "#/util/logger";

hmr.log(import.meta);

class Python {
  async run(params: string[]) {
    log.debug(`Running python with params: ${params.join(" ")}`);
    const subprocess = execa(env.PYTHON_BIN_PATH, params);

    subprocess.stdout?.on("data", (data) => {
      log.trace(`[python stdout] ${data.toString().trim()}`);
    });

    subprocess.stderr?.on("data", (data) => {
      log.trace(`[python stderr] ${data.toString().trim()}`);
    });

    const { stdout, stderr } = await subprocess;

    log.debug(
      {
        params: stdout,
        stderr,
      },
      "python",
    );
    return stdout;
  }

  async runEntry(params: string[]) {
    const finalParams = [env.PYTHON_ENTRY_PATH, ...params];
    return await this.run(finalParams);
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
    const fileName = downloadUrl.split("/").pop();
    log.info(`Downloading ${fileName} from ${downloadUrl}`);

    const downloadedFilePath = await cache.download({
      downloadUrl,
      fileName,
      fallbackFileName: "python.tar.gz",
    });

    return downloadedFilePath;
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

  async install() {
    const outputPath = await python.download();
    await python.extract({ tarPath: outputPath });
    await python.installDeps();
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
