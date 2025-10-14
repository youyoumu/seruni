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
    pictureField: z.string().default("Picture"),
    sentenceAudioField: z.string().default("SentenceAudio"),
    ankiConnectPort: z.number().default(8765),
  }),
  obs: z.object({
    obsWebSocketPort: z.number().default(7274),
  }),
  textractor: z.object({
    textractorWebSocketPort: z.number().default(6677),
  }),
});

export const defaultConfig = zConfig.parse({
  window: {},
  anki: {},
  obs: {},
  textractor: {},
});
