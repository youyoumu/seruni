import Config, { type Schema } from "conf";
import { app } from "electron";
import { debounce } from "es-toolkit";
import { parse, stringify } from "smol-toml";
import type { PartialDeep, Paths } from "type-fest";
import z from "zod";
import { env } from "#/env";

const configSchema = z.object({
  window: z.object({
    vn_overlay: z.object({
      font: z.string(),
      fontSize: z.number(),
      fontWeight: z.number(),
      windowColor: z.string(),
      backgroundColor: z.string(),
      textColor: z.string(),
    }),
  }),
});

type ConfigSchema = z.infer<typeof configSchema>;

class Config2 extends Config<ConfigSchema> {
  constructor() {
    super({
      projectName: app.getName(),
      cwd: env.USER_DATA_PATH,
      configName: "config",
      fileExtension: "toml",
      deserialize: parse as typeof JSON.parse,
      serialize: stringify,
      schema: z.toJSONSchema(configSchema).properties as Schema<ConfigSchema>,
    });
  }

  debouncedSet = debounce<(value: PartialDeep<ConfigSchema>) => void>(
    this.set,
    1000,
  );

  override get(key: Paths<ConfigSchema>) {
    return super.get(key);
  }
}

export const config = new Config2();
