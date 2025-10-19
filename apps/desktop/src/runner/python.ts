import { access, cp } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import * as tar from "tar";
import { env } from "#/env";
import { cache } from "#/util/cache";
import { log } from "#/util/logger";

type SileroCommand = ["silero", string];
type CheckhealthCommand = ["checkhealth"];
type MainCommand = SileroCommand | CheckhealthCommand;

class Python {
  async run(params: string[]) {
    log.info({ params }, `Running python`);
    const subprocess = execa(env.PYTHON_BIN_PATH, params);

    subprocess.stdout?.on("data", (data) => {
      log.trace(`[python stdout] ${data.toString().trim()}`);
    });
    subprocess.stderr?.on("data", (data) => {
      log.trace(`[python stderr] ${data.toString().trim()}`);
    });

    const { stdout, stderr } = await subprocess;
    log.debug({ params, stdout, stderr }, "python");
    return { stdout, stderr };
  }

  async runMain(params: MainCommand) {
    const finalParams = [
      "-m",
      "uv",
      "run",
      "--directory",
      env.PYTHON_VENV_PATH,
      env.PYTHON_MAIN_PATH,
      ...params,
    ];
    return await this.run(finalParams);
  }

  async runMainCheckhealth() {
    return JSON.parse((await this.runMain(["checkhealth"])).stdout);
  }

  async runCheckhealth() {
    const finalParams = [env.PYTHON_HEALTHCHECK_PATH];
    return JSON.parse((await this.run(finalParams)).stdout);
  }

  async runUvPipList() {
    const finalParams = ["-m", "uv", "pip", "list", "--format", "json"];
    return JSON.parse((await this.run(finalParams)).stdout);
  }

  async runPipList() {
    const finalParams = ["-m", "pip", "list", "--format", "json"];
    return JSON.parse((await this.run(finalParams)).stdout);
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

    try {
      await tar.x({
        file: tarPath,
        cwd: env.BIN_PATH,
        strict: true, // throw errors on bad entries
      });

      log.info(`Extracted ${tarPath} to ${env.BIN_PATH}`);
      return env.BIN_PATH;
    } catch (err) {
      log.error({ error: err }, `Failed to extract ${tarPath}`);
      throw err;
    }
  }

  async install() {
    const outputPath = await this.download();
    await this.extract({ tarPath: outputPath });
  }

  async installUv() {
    await this.run(["-m", "pip", "install", "uv"]);
  }

  async installDependencies() {
    await cp(
      join(env.PYTHON_PROJECT_PATH, "pyproject.toml"),
      join(env.PYTHON_VENV_PATH, "pyproject.toml"),
      { recursive: true },
    );
    await cp(
      join(env.PYTHON_PROJECT_PATH, "uv.lock"),
      join(env.PYTHON_VENV_PATH, "uv.lock"),
      { recursive: true },
    );
    await this.run(["-m", "uv", "sync", "--directory", env.PYTHON_VENV_PATH]);
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

export const python = hmr.module(new Python());

//  ───────────────────────────────── HMR ─────────────────────────────────

type Self = typeof import("./python");
const module: Self = { python };
if (import.meta.hot) {
  hmr.register<Self>(import.meta, module);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
  });
}
