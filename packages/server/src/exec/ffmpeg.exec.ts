import type { State } from "#/state/state";
import type { Logger } from "pino";

import { Exec } from "./Exec";

export class FFmpegExec extends Exec {
  constructor({ logger, state }: { logger: Logger; state: State }) {
    super({
      name: "ffmpeg",
      logger,
      state,
      bin: "ffmpeg",
    });
  }

  async version() {
    try {
      const { stdout } = await this.run(["-version"]);
      return stdout.split("\n")[0] ?? "";
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when checking ffmpeg version");
    }
  }
}
