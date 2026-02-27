import * as z from "zod/mini";

export const zConfig = z.object({
  ankiExpressionField: z.catch(z.string(), "Expression"),
  ankiSentenceField: z.catch(z.string(), "Sentence"),
  ankiPictureField: z.catch(z.string(), "Picture"),
  ankiSentenceAudioField: z.catch(z.string(), "SentenceAudio"),
  ankiConnectAddress: z.catch(z.string().check(z.url()), "http://127.0.0.1:8765"),
  obsWebSocketAddress: z.catch(z.string().check(z.url()), "ws://127.0.0.1:4455"),
  obsReplayBufferDuration: z.catch(z.number(), 5 * 60 * 1000),
  textHookerWebSocketAddress: z.catch(z.string().check(z.url()), "ws://127.0.0.1:6677"),
  ffmpegPictureFormat: z.catch(z.union([z.literal("webp")]), "webp"),
  ffmpegMaxPictureResolution: z.catch(z.number(), 720),
  ffmpegPictureFrameCount: z.catch(z.number(), 6),
});
