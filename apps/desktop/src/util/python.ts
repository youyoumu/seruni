import { execa } from "execa";
import { env } from "#/env";
import { log } from "./logger";

export async function python(params: string[]) {
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
