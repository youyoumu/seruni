import z from "zod";

export const zConfig = z.object({
  ankiExpressionField: z.string().catch("Expression"),
  ankiSentenceField: z.string().catch("Sentence"),
  ankiPictureField: z.string().catch("Picture"),
  ankiSentenceAudioField: z.string().catch("SentenceAudio"),
  ankiConnectAddress: z.url().catch("http://127.0.0.1:8765"),
  obsWebSocketAddress: z.url().catch("ws://127.0.0.1:4455"),
  obsReplayBufferDuration: z.number().catch(5 * 60 * 1000),
  textHookerWebSocketAddress: z.url().catch("ws://127.0.0.1:6677"),
  ffmpegPictureFormat: z.union([z.literal("webp")]).catch("webp"),
  ffmpegMaxPictureResolution: z.number().catch(720),
  ffmpegPictureFrameCount: z.number().catch(6),
});
