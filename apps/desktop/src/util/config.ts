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
      opacity: z.number(),
    }),
  }),
});

type ConfigSchema = z.infer<typeof configSchema>;
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
      schema: z.toJSONSchema(configSchema).properties as Schema<ConfigSchema>,
      defaults: {
        window: {
          vn_overlay: {
            font: "'Noto Sans JP'",
            fontSize: 24,
            fontWeight: 400,
            windowColor: "#ffffff",
            backgroundColor: "#000000",
            textColor: "#ffffff",
            opacity: 0.5,
          },
        },
      },
    });
  }

  debouncedSet = debounce<(value: ConfigSchemaPartial) => void>(this.set, 1000);

  override get(key: Paths<ConfigSchema>) {
    return super.get(key);
  }

  getAll() {
    return structuredClone(this.store);
  }
}

export const config = new Config_();
