import crypto from "node:crypto";
import path from "node:path";

import { Exec } from "#/exec/Exec";
import { safeReadFile, safeWriteFile } from "#/util/fs";
import { createLogger } from "#/util/logger";
import { hashFile } from "#/util/result";
import { R } from "@praha/byethrow";

import { getPackageVersion, RELEASE_DIR, ROOT_DIR } from "./util";

class Script {
  async run() {
    const log = createLogger();
    const tar = new Exec(log, "tar", "tar");
    const fileName = `seruni-v${getPackageVersion()}.tar.gz`;
    const output = path.join(RELEASE_DIR, fileName);
    await tar.run(["-czf", output, "-C", "dist", "."]);

    const hashResult = await hashFile(output, "sha256");
    const hash = R.unwrap(hashResult);
    const manifestFileName = `seruni-v${getPackageVersion()}.manifest.json`;
    const manifestOutput = path.join(RELEASE_DIR, manifestFileName);

    const privateKey = R.unwrap(
      await safeReadFile(path.join(ROOT_DIR, "id_ed25519_seruni"), "utf-8"),
    );

    const signature = crypto.sign(null, Buffer.from(hash), privateKey).toString("hex");

    const manifest = {
      version: getPackageVersion(),
      hash,
      signature,
    };

    await safeWriteFile(manifestOutput, JSON.stringify(manifest, null, 2));
  }
}

const script = new Script();
void script.run();
