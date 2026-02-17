import { execa } from "execa";

export class UvExec {
  async version() {
    try {
      const { stdout } = await execa({ all: true })`uv --version`;
      return stdout;
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when checking uv version");
    }
  }
}
