import type { State } from "#/state/state";
import { format as formatDate } from "date-fns";
import { execa } from "execa";
import type { Logger } from "pino";
import { uid } from "uid";

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

  timestamps = new Set<string>();
  createTimestamp(): string {
    const timestamp = `${formatDate(new Date(), "yyyyMMdd_HHmmss")}_${uid().slice(0, 3)}`;
    if (this.timestamps.has(timestamp)) {
      return this.createTimestamp();
    }
    this.timestamps.add(timestamp);
    return timestamp;
  }

  async getFileDuration(filePath: string): Promise<number> {
    const params = ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath];
    const { stdout, stderr } = await execa("ffprobe", params);
    this.log.trace({ params, stdout, stderr }, "ffprobe");
    return parseFloat(stdout.trim()) * 1000;
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
