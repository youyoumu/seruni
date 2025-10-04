import { execa } from "execa";
import { env } from "#/env";
import { log } from "./logger";

export async function python(params: string[]) {
  const { stdout, stderr } = await execa(env.PYTHON_BIN_PATH, [
    env.PYTHON_ENTRY_PATH,
    ...params,
  ]);

  log.trace({ stdout, stderr }, "python");
  return stdout;
}
