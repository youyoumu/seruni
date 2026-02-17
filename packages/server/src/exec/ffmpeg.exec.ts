import { execa } from "execa";

export class FFmpegExec {
  async version() {
    try {
      const { stdout } = await execa({ all: true })`ffmpeg -version`;
      return stdout.split("\n")[0] ?? "";
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when checking ffmpeg version");
    }
  }
}
