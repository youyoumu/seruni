import z from "zod";

export const zConfig = z.object({
  ankiExpressionField: z.string().default("Expression"),
  ankiSentenceField: z.string().default("Sentence"),
  ankiPictureField: z.string().default("Picture"),
  ankiSentenceAudioField: z.string().default("SentenceAudio"),
  ankiConnectAddress: z.string().default("http://127.0.0.1:8765"),
  obsWebSocketAddress: z.string().default("ws://127.0.0.1:4455"),
  textHookerWebSocketAddress: z.string().default("ws://127.0.0.1:6677"),
});
