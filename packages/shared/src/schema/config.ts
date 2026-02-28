import * as z from "zod/mini";

const zStartsWithHttp = z.startsWith("http", "Must start with http");
const zStartsWithWs = z.startsWith("ws", "Must start with ws");
const zUrl = z.url("Invalid URL");
const zNoSpace = z.refine((v) => typeof v === "string" && !v.includes(" "), "Cannot contain space");

const zAnkiExpressionField = z.string().check(z.trim(), zNoSpace);
const zAnkiSentenceField = z.string().check(z.trim(), zNoSpace);
const zAnkiPictureField = z.string().check(z.trim(), zNoSpace);
const zAnkiSentenceAudioField = z.string().check(z.trim(), zNoSpace);

const zAnkiConnectAddress = z.string().check(z.trim(), zUrl, zStartsWithHttp);
const zObsWebSocketAddress = z.string().check(z.trim(), zUrl, zStartsWithWs);
const zTextHookerWebSocketAddress = z.string().check(z.trim(), zUrl, zStartsWithWs);

const zObsReplayBufferDurationS = z.number();
const zFfmpegPictureFormat = z.union(
  [z.literal("webp", "Must be WebP"), z.literal("jpeg", "Must be JPEG")],
  "Must be WebP or JPEG",
);
const zFfmpegMaxPictureResolution = z.union(
  [z.literal(720, "Must be 720"), z.literal(1080, "Must be 1080")],
  "Must be 720 or 1080",
);
const zFfmpegPictureFrameCount = z
  .number()
  .check(z.minimum(1, "Must be greater than 0"), z.maximum(99, "Must be less than 100"));

export const zConfigStrict = z.object({
  ankiExpressionField: zAnkiExpressionField,
  ankiSentenceField: zAnkiSentenceField,
  ankiPictureField: zAnkiPictureField,
  ankiSentenceAudioField: zAnkiSentenceAudioField,
  ankiConnectAddress: zAnkiConnectAddress,
  obsWebSocketAddress: zObsWebSocketAddress,
  obsReplayBufferDurationS: zObsReplayBufferDurationS,
  textHookerWebSocketAddress: zTextHookerWebSocketAddress,
  ffmpegPictureFormat: zFfmpegPictureFormat,
  ffmpegMaxPictureResolution: zFfmpegMaxPictureResolution,
  ffmpegPictureFrameCount: zFfmpegPictureFrameCount,
});

export const zConfig = z.object({
  ankiExpressionField: z.catch(zAnkiExpressionField, "Expression"),
  ankiSentenceField: z.catch(zAnkiSentenceField, "Sentence"),
  ankiPictureField: z.catch(zAnkiPictureField, "Picture"),
  ankiSentenceAudioField: z.catch(zAnkiSentenceAudioField, "SentenceAudio"),
  ankiConnectAddress: z.catch(zAnkiConnectAddress, "http://127.0.0.1:8765"),
  obsWebSocketAddress: z.catch(zObsWebSocketAddress, "ws://127.0.0.1:4455"),
  obsReplayBufferDurationS: z.catch(zObsReplayBufferDurationS, 5 * 60),
  textHookerWebSocketAddress: z.catch(zTextHookerWebSocketAddress, "ws://127.0.0.1:6677"),
  ffmpegPictureFormat: z.catch(zFfmpegPictureFormat, "webp"),
  ffmpegMaxPictureResolution: z.catch(zFfmpegMaxPictureResolution, 720),
  ffmpegPictureFrameCount: z.catch(zFfmpegPictureFrameCount, 6),
});

export type Config = z.infer<typeof zConfig>;
