import z from "zod";

export const zVnOverlaySettings = z.object({
  font: z.string().default("Noto Sans JP"),
  fontSize: z.number().default(24),
  fontWeight: z.number().default(400),
  windowColor: z.string().default("#ffffff"),
  backgroundColor: z.string().default("#000000"),
  textColor: z.string().default("#ffffff"),
  opacity: z.number().default(0.5),
});

export const zConfig = z.object({
  window: z.object({
    vn_overlay: zVnOverlaySettings.default(zVnOverlaySettings.parse({})),
  }),
  anki: z.object({
    expressionField: z.string().default("Expression"),
    sentenceField: z.string().default("Sentence"),
    pictureField: z.string().default("Picture"),
    sentenceAudioField: z.string().default("SentenceAudio"),
    ankiConnectPort: z.number().default(8765),
  }),
  obs: z.object({
    obsWebSocketPort: z.number().default(4455),
  }),
  textractor: z.object({
    textractorWebSocketPort: z.number().default(6677),
  }),
});

export type Config = z.infer<typeof zConfig>;

export const defaultConfig = zConfig.parse({
  window: {},
  anki: {},
  obs: {},
  textractor: {},
});

export const zAnkiNote = z.object({
  cards: z.array(z.number()),
  fields: z.record(
    z.string(),
    z.object({ order: z.number(), value: z.string() }),
  ),
  mod: z.number(),
  modelName: z.string(),
  noteId: z.number(),
  profile: z.string(),
  tags: z.array(z.string()),
});

export type AnkiNote = z.infer<typeof zAnkiNote>;
