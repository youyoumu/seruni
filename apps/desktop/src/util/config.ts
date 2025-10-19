import { defaultConfig, zConfig } from "@repo/preload/ipc";
import Config, { type Schema } from "conf";
import { app } from "electron";
import { debounce } from "es-toolkit";
import { parse, stringify } from "smol-toml";
import type { PartialDeep } from "type-fest";
import z from "zod";
import { env } from "#/env";

type ConfigSchema = z.infer<typeof zConfig>;
type ConfigSchemaPartial = PartialDeep<ConfigSchema>;

class Config_ extends Config<ConfigSchema> {
  constructor() {
    super({
      projectName: app.getName(),
      cwd: env.USER_DATA_PATH,
      configName: "config",
      fileExtension: "toml",
      deserialize: parse as typeof JSON.parse,
      serialize: stringify,
      schema: z.toJSONSchema(zConfig).properties as Schema<ConfigSchema>,
      defaults: defaultConfig,
      ajvOptions: {
        allErrors: true,
        useDefaults: true,
        removeAdditional: true,
      },
    });
  }

  debouncedSet = debounce<(value: ConfigSchemaPartial) => void>(this.set, 1000);

  override get() {
    throw new Error("Use store instead");
  }
}

export const config = new Config_();
