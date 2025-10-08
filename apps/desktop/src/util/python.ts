import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import * as tar from "tar";
import { env } from "#/env";
import { log } from "./logger";

export async function pythonEntry(params: string[]) {
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

export async function python(params: string[]) {
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

export async function downloadPython() {
  const res = await fetch(
    "https://raw.githubusercontent.com/astral-sh/python-build-standalone/latest-release/latest-release.json",
  );
  if (!res.ok) throw new Error("Failed to fetch python version");
  const { release_url } = (await res.json()) as { release_url: string };
  const tag = release_url.split("/").pop();
  if (!tag) throw new Error("Failed to extract release tag");
  const apiUrl = `https://api.github.com/repos/astral-sh/python-build-standalone/releases/tags/${tag}`;
  const releaseRes = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!releaseRes.ok)
    throw new Error(`Failed to fetch release data for ${tag}`);

  const releaseData = (await releaseRes.json()) as {
    assets: { name: string; browser_download_url: string }[];
  };

  const pythonReleaseSuffix: Partial<Record<NodeJS.Platform, string>> = {
    win32: "x86_64-pc-windows-msvc-install_only_stripped.tar.gz",
    linux: "x86_64-unknown-linux-gnu-install_only_stripped.tar.gz",
  };

  const suffix = pythonReleaseSuffix[process.platform];
  if (!suffix) {
    throw new Error(`No suffix found for platform ${process.platform}`);
  }

  const pythonVersion = "3.13"; // or "3.13.0"
  const asset = releaseData.assets.find(
    (item) =>
      item.name.startsWith(`cpython-${pythonVersion}`) &&
      item.name.includes(suffix),
  );
  if (!asset) {
    throw new Error("No matching Python build found for your platform.");
  }

  log.info(`Downloading ${asset.name} from ${asset.browser_download_url}`);

  const assetRes = await fetch(asset.browser_download_url);
  const buffer = await assetRes.arrayBuffer();
  const outputPath = join(env.PYTHON_EXTRACT_PATH, asset.name);
  await writeFile(outputPath, Buffer.from(buffer));

  log.info(`Downloaded ${outputPath} successfully!`);

  return outputPath;
}

export async function extractPython({ tarPath }: { tarPath: string }) {
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

export async function installPythonDeps() {
  await python(["-m", "pip", "install", "uv"]);
  await python(["-m", "uv", "pip", "install", env.PYTHON_PACKAGE_PATH]);
}
