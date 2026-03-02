import path from "node:path";

import { Exec } from "#/exec/Exec";
import { createLogger } from "#/util/logger";

import { getPackageVersion, RELEASE_DIR } from "./util";

class Script {
  async run() {
    const log = createLogger();
    const tar = new Exec(log, "tar", "tar");
    const fileName = `seruni-v${getPackageVersion()}.tar.gz`;
    const output = path.join(RELEASE_DIR, fileName);
    await tar.run(["-czf", output, "dist"]);
  }
}

const script = new Script();
void script.run();
