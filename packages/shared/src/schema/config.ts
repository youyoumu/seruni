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

const zObsReplayBufferDurationS = z.number().check(z.minimum(1, "Must be greater than 0"));
const zObsWebSocketPassword = z.union([z.null(), z.string()]);

const zFfmpegPictureFormat = z.union(
  [z.literal("webp", "Must be WebP"), z.literal("jpeg", "Must be JPEG")],
  "Must be WebP or JPEG",
);
const zFfmpegPictureQuality = z.union(
  [
    z.literal("very-low", "Must be very low"),
    z.literal("low", "Must be low"),
    z.literal("medium", "Must be medium"),
    z.literal("high", "Must be high"),
    z.literal("very-high", "Must be very high"),
  ],
  "Must be very low, low, medium, high, or very high",
);
const zFfmpegMaxPictureResolution = z.union(
  [z.literal(720, "Must be 720"), z.literal(1080, "Must be 1080")],
  "Must be 720 or 1080",
);
const zFfmpegPictureFrameCount = z
  .number()
  .check(z.minimum(1, "Must be greater than 0"), z.maximum(99, "Must be less than 100"));

const zFfmpegAudioFormat = z.union(
  [z.literal("opus", "Must be Opus"), z.literal("mp3", "Must be MP3")],
  "Must be Opus or MP3",
);
const zFfmpegAudioQuality = z.union(
  [
    z.literal("very-low", "Must be very low"),
    z.literal("low", "Must be low"),
    z.literal("medium", "Must be medium"),
    z.literal("high", "Must be high"),
    z.literal("very-high", "Must be very high"),
  ],
  "Must be very low, low, medium, high, or very high",
);
const zFfmpegAudioOffsetStart = z.number().check(z.maximum(0, "Must be less than or equal to 0"));
const zFfmpegAudioOffsetEnd = z.number().check(z.minimum(0, "Must be greater than or equal to 0"));

export const zConfig = z.object({
  ankiExpressionField: zAnkiExpressionField,
  ankiSentenceField: zAnkiSentenceField,
  ankiPictureField: zAnkiPictureField,
  ankiSentenceAudioField: zAnkiSentenceAudioField,
  ankiConnectAddress: zAnkiConnectAddress,
  obsWebSocketAddress: zObsWebSocketAddress,
  obsReplayBufferDurationS: zObsReplayBufferDurationS,
  obsWebSocketPassword: zObsWebSocketPassword,
  textHookerWebSocketAddress: zTextHookerWebSocketAddress,
  ffmpegPictureFormat: zFfmpegPictureFormat,
  ffmpegPictureQuality: zFfmpegPictureQuality,
  ffmpegMaxPictureResolution: zFfmpegMaxPictureResolution,
  ffmpegPictureFrameCount: zFfmpegPictureFrameCount,
  ffmpegAudioFormat: zFfmpegAudioFormat,
  ffmpegAudioQuality: zFfmpegAudioQuality,
  ffmpegAudioOffsetStart: zFfmpegAudioOffsetStart,
  ffmpegAudioOffsetEnd: zFfmpegAudioOffsetEnd,
});

export type Config = z.infer<typeof zConfig>;

export const defaultConfig: Config = {
  ankiExpressionField: "Expression",
  ankiSentenceField: "Sentence",
  ankiPictureField: "Picture",
  ankiSentenceAudioField: "SentenceAudio",
  ankiConnectAddress: "http://127.0.0.1:8765",
  obsWebSocketAddress: "ws://127.0.0.1:4455",
  obsReplayBufferDurationS: 5 * 60,
  obsWebSocketPassword: null,
  textHookerWebSocketAddress: "ws://127.0.0.1:6677",
  ffmpegPictureFormat: "webp",
  ffmpegPictureQuality: "medium",
  ffmpegMaxPictureResolution: 720,
  ffmpegPictureFrameCount: 6,
  ffmpegAudioFormat: "opus",
  ffmpegAudioQuality: "medium",
  ffmpegAudioOffsetStart: -500,
  ffmpegAudioOffsetEnd: 500,
};
