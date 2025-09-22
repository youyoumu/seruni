import path from "node:path";
import { log } from "#/util/logger";
import { Extension } from "./_util";

class YomitanExtension extends Extension {
  constructor() {
    super({
      name: "yomitan",
      downloadUrl: async () => {
        const apiUrl =
          "https://api.github.com/repos/themoeway/yomitan/releases/latest";
        const res = await fetch(apiUrl);
        const release = (await res.json()) as {
          assets: { browser_download_url: string; name: string }[];
        };

        const asset = release.assets.find((a) =>
          a.name.includes("yomitan-chrome.zip"),
        );
        if (!asset) throw new Error("Chrome zip not found in release");
        return asset.browser_download_url;
      },
    });
  }

  override async extractExtension() {
    const extensionPath = await super.extractExtension();
    if (!extensionPath) {
      log.warn("Cancelling yomitan shimming");
      return;
    }

    //shim some yomitan files
    const targets = [
      path.join(extensionPath, "js", "data", "permissions-util.js"),
      path.join(extensionPath, "js", "data", "options-util.js"),
      path.join(
        extensionPath,
        "js",
        "pages",
        "common",
        "extension-content-controller.js",
      ),
      path.join(extensionPath, "js", "pages", "action-popup-main.js"),
      path.join(extensionPath, "js", "background", "backend.js"),
      path.join(extensionPath, "js", "display", "display.js"),
    ];
    for (const target of targets) {
      try {
        Extension.shimFile(
          target,
          path.join(import.meta.dirname, "./yomitan-shim.js"),
        );
        log.debug(`Shimmed: ${target}`);
      } catch (e) {
        log.error({ error: e }, `Failed to shim: ${target}`);
      }
    }

    //update permissions
    this.updateManifestPermissions({
      remove: ["contextMenus"],
    });
    return extensionPath;
  }
}

export const yomitanExtension = new YomitanExtension();
