import z from "zod";

export const vnOverlaySettings = z.object({
  font: z.string(),
  fontSize: z.number(),
  fontWeight: z.number(),
  windowColor: z.string(),
  backgroundColor: z.string(),
  textColor: z.string(),
  opacity: z.number(),
});

export const configSchema = z.object({
  window: z.object({
    vn_overlay: vnOverlaySettings,
  }),
  anki: z.object({
    pictureField: z.string(),
    sentenceAudioField: z.string(),
    ankiConnectPort: z.number(),
  }),
  obs: z.object({
    obsWebSocketPort: z.number(),
  }),
});
