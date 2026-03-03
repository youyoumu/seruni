import path from "node:path";

import { Exec } from "#/exec/Exec";
import { safeWriteFile } from "#/util/fs";
import { createLogger } from "#/util/logger";
import { hashFile } from "#/util/result";
import { R } from "@praha/byethrow";

import { getPackageVersion, RELEASE_DIR } from "./util";

class Script {
  async run() {
    const log = createLogger();
    const tar = new Exec(log, "tar", "tar");
    const fileName = `seruni-v${getPackageVersion()}.tar.gz`;
    const output = path.join(RELEASE_DIR, fileName);
    await tar.run(["-czf", output, "-C", "dist", "."]);

    const hashResult = await hashFile(output, "sha256");
    const hash = R.unwrap(hashResult);
    const hashFileName = `${fileName}.sha256`;
    const hashOutput = path.join(RELEASE_DIR, hashFileName);
    await safeWriteFile(hashOutput, hash);
  }
}

const script = new Script();
void script.run();
